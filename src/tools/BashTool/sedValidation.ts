/**
 * Sed-specific security validation for bash commands.
 *
 * Implements the same logic as Claude Code's sed validation:
 * - Allowlist-based approach: only known-safe sed patterns pass through
 * - Print commands (read-only) are always safe
 * - Substitution commands are safe when they don't use dangerous features
 * - Dangerous operations (write, execute, shell escape) are blocked
 *
 * Design: fail-closed. Unknown constructs → ask user for permission.
 */

import type { PermissionResult } from '../../Tool.js'
import type { ToolPermissionContext } from '../../types/permissions.js'

// ============================================================================
// 1. isPrintCommand
// ============================================================================

/**
 * Check if a sed expression is a simple print command.
 *
 * Matches: `p`, `1p`, `123p`, `1,5p`
 * These are read-only operations that just output lines.
 */
export function isPrintCommand(cmd: string): boolean {
  return /^(?:\d+|\d+,\d+)?p$/.test(cmd)
}

// ============================================================================
// 2. isLinePrintingCommand
// ============================================================================

/** Flags that are safe to use with sed -n (line-printing mode) */
const LINE_PRINTING_ALLOWED_FLAGS = new Set([
  '-n',
  '--quiet',
  '--silent',
  '-E',
  '--regexp-extended',
  '-r',
  '-z',
  '--zero-terminated',
  '--posix',
])

/**
 * Check if a sed command is a safe line-printing command.
 *
 * Requirements:
 * - Must have the `-n` flag (suppress default output)
 * - All flags must be in the allowed set
 * - All expressions must be print commands (possibly semicolon-separated)
 */
export function isLinePrintingCommand(
  command: string,
  expressions: string[],
): boolean {
  const tokens = tokenizeCommand(command)

  // Must have -n flag
  let hasN = false
  for (const token of tokens) {
    if (token === '-n' || token === '--quiet' || token === '--silent') {
      hasN = true
    }
  }
  if (!hasN) return false

  // Check all flags are allowed
  for (const token of tokens) {
    if (token.startsWith('-') && !LINE_PRINTING_ALLOWED_FLAGS.has(token)) {
      // Skip -e and --expression as they are handled separately
      if (token === '-e' || token.startsWith('--expression')) continue
      return false
    }
  }

  // All expressions must be print commands
  for (const expr of expressions) {
    // Expressions can be semicolon-separated
    const parts = expr.split(';')
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed === '') continue
      if (!isPrintCommand(trimmed)) return false
    }
  }

  return true
}

// ============================================================================
// 3. isSubstitutionCommand
// ============================================================================

/** Flags allowed for substitution commands */
const SUBSTITUTION_ALLOWED_FLAGS = new Set([
  '-E',
  '--regexp-extended',
  '-r',
  '--posix',
])

/** Regex for valid substitution flags (g, p, i, I, m, M, optionally one digit 1-9) */
const VALID_SUB_FLAGS_RE = /^[gpimIM]*[1-9]?[gpimIM]*$/

/**
 * Check if a sed command is a safe substitution command.
 *
 * Requirements:
 * - Exactly one expression
 * - Expression starts with 's'
 * - Valid delimiter and proper s/pattern/replacement/flags structure
 * - Only safe flags (g, p, i, I, m, M, one digit)
 * - Command-level flags must be in allowed set
 * - If allowFileWrites, -i/--in-place is additionally allowed
 */
export function isSubstitutionCommand(
  command: string,
  expressions: string[],
  hasFileArguments: boolean,
  options?: { allowFileWrites?: boolean },
): boolean {
  const allowFileWrites = options?.allowFileWrites ?? false

  const tokens = tokenizeCommand(command)

  // Check all flags are allowed
  for (const token of tokens) {
    if (token.startsWith('-') && token !== '-e' && !token.startsWith('--expression')) {
      if (SUBSTITUTION_ALLOWED_FLAGS.has(token)) continue
      if (allowFileWrites && (token === '-i' || token.startsWith('--in-place'))) continue
      return false
    }
  }

  // Must have exactly one expression
  if (expressions.length !== 1) return false

  const expr = expressions[0]!

  // Expression must start with 's'
  if (!expr.startsWith('s')) return false

  // Parse the substitution: s/pattern/replacement/flags
  // The delimiter is the character immediately after 's'
  const delimiter = expr[1]
  if (delimiter === undefined) return false

  // Find the three delimiter positions: s<d>pattern<d>replacement<d>flags
  let pos = 2 // start after 's' and delimiter
  let delimiterCount = 0
  let inBracketExpr = false
  const sections: string[] = []
  let current = ''

  while (pos < expr.length) {
    const ch = expr[pos]!

    // Handle backslash escapes
    if (ch === '\\' && pos + 1 < expr.length) {
      current += ch + expr[pos + 1]!
      pos += 2
      continue
    }

    // Handle bracket expressions in the pattern (first section)
    if (delimiterCount === 0) {
      if (ch === '[' && !inBracketExpr) {
        inBracketExpr = true
        current += ch
        pos++
        continue
      }
      if (ch === ']' && inBracketExpr) {
        inBracketExpr = false
        current += ch
        pos++
        continue
      }
    }

    if (ch === delimiter && !inBracketExpr) {
      sections.push(current)
      current = ''
      delimiterCount++
      pos++
      continue
    }

    current += ch
    pos++
  }

  // The remaining text after the last delimiter is the flags
  // We need exactly 2 delimiters (pattern and replacement sections)
  if (delimiterCount < 2) return false

  const flags = current

  // Validate the flags
  if (!VALID_SUB_FLAGS_RE.test(flags)) return false

  return true
}

// ============================================================================
// 4. extractSedExpressions
// ============================================================================

/** Dangerous flag combinations that could enable code execution */
const DANGEROUS_FLAG_COMBOS = new Set(['-ew', '-eW', '-ee', '-we'])

/**
 * Extract sed expressions from a command string.
 *
 * Handles:
 * - `-e expr` and `--expression expr` flags
 * - `--expression=expr` format
 * - `-e=value` format
 * - Inline expressions (first non-flag argument)
 * - Rejects dangerous flag combinations (-ew, -eW, -ee, -we)
 */
export function extractSedExpressions(command: string): string[] {
  const tokens = tokenizeCommand(command)
  const expressions: string[] = []
  let i = 0

  // Skip the 'sed' command itself
  if (tokens.length > 0 && tokens[0] === 'sed') {
    i = 1
  }

  let foundInlineExpr = false

  while (i < tokens.length) {
    const token = tokens[i]!

    // Check for dangerous flag combinations
    if (DANGEROUS_FLAG_COMBOS.has(token)) {
      return [] // Return empty to signal danger
    }

    // --expression=value
    if (token.startsWith('--expression=')) {
      expressions.push(token.slice('--expression='.length))
      i++
      continue
    }

    // -e=value
    if (token.startsWith('-e=')) {
      expressions.push(token.slice('-e='.length))
      i++
      continue
    }

    // -e expr or --expression expr
    if (token === '-e' || token === '--expression') {
      i++
      if (i < tokens.length) {
        expressions.push(tokens[i]!)
      }
      i++
      continue
    }

    // Known flags that take no argument
    if (token.startsWith('-')) {
      i++
      continue
    }

    // First non-flag argument is an inline expression (if no -e was used)
    if (!foundInlineExpr && expressions.length === 0) {
      expressions.push(token)
      foundInlineExpr = true
    }

    i++
  }

  return expressions
}

// ============================================================================
// 5. hasFileArgs
// ============================================================================

/**
 * Check if a sed command has file arguments (files to process).
 *
 * Parses command tokens, skips flags and expressions,
 * then checks if there are remaining non-flag arguments.
 */
export function hasFileArgs(command: string): boolean {
  const tokens = tokenizeCommand(command)
  let i = 0

  // Skip 'sed'
  if (tokens.length > 0 && tokens[0] === 'sed') {
    i = 1
  }

  let expressionConsumed = false
  let nonFlagArgCount = 0

  while (i < tokens.length) {
    const token = tokens[i]!

    // --expression=value
    if (token.startsWith('--expression=')) {
      expressionConsumed = true
      i++
      continue
    }

    // -e=value
    if (token.startsWith('-e=')) {
      expressionConsumed = true
      i++
      continue
    }

    // -e expr or --expression expr (consumes next token)
    if (token === '-e' || token === '--expression') {
      expressionConsumed = true
      i += 2 // skip flag and its argument
      continue
    }

    // Skip other flags
    if (token.startsWith('-')) {
      i++
      continue
    }

    // Non-flag argument
    if (!expressionConsumed) {
      // First non-flag arg is the inline expression
      expressionConsumed = true
      i++
      continue
    }

    // Any further non-flag args are file arguments
    nonFlagArgCount++
    i++
  }

  return nonFlagArgCount > 0
}

// ============================================================================
// 6. containsDangerousOperations
// ============================================================================

/**
 * Check if any sed expression contains dangerous operations.
 *
 * This is the core security check. It inspects expressions for:
 * - Non-ASCII characters (unicode obfuscation)
 * - Curly braces (grouped commands)
 * - Newlines (multi-line tricks)
 * - Comments (code hiding)
 * - Negation (! address modifier)
 * - GNU step addressing (~)
 * - Comma edge cases
 * - Backslash obfuscation
 * - Write (w/W) commands
 * - Execute (e/E) commands
 * - Substitution flags with w/W/e/E
 * - Transliterate (y) with w/W/e/E
 */
export function containsDangerousOperations(expressions: string[]): boolean {
  for (const expr of expressions) {
    // Non-ASCII characters
    if (/[^\x01-\x7F]/.test(expr)) return true

    // Curly braces (grouped commands / blocks)
    if (expr.includes('{') || expr.includes('}')) return true

    // Newlines
    if (expr.includes('\n')) return true

    // Comments: # is dangerous unless immediately after an 's' delimiter
    // e.g., s#foo#bar# is a valid substitution with # as delimiter
    if (hasUnsafeComment(expr)) return true

    // Negation (address modifier)
    if (expr.includes('!')) return true

    // GNU step addressing: \d~\d, ,~\d, $~\d
    if (/\d~\d/.test(expr)) return true
    if (/,~\d/.test(expr)) return true
    if (/\$~\d/.test(expr)) return true

    // Comma at start
    if (expr.startsWith(',')) return true

    // Comma with offset: ,[+-]
    if (/,[+-]/.test(expr)) return true

    // Backslash tricks: s\ (substitution with backslash delimiter)
    if (/^s\\/.test(expr)) return true
    // Pattern starting with backslash followed by |#%@
    if (/^\\[|#%@]/.test(expr)) return true

    // Write commands (w/W) with various address forms
    // Bare w/W command
    if (/^[wW]\s/.test(expr) || expr === 'w' || expr === 'W') return true
    // With numeric address: \dw, \dW
    if (/^\d+[wW]/.test(expr)) return true
    // With address range: \d,\dw or \d,\dW
    if (/^\d+,\d+[wW]/.test(expr)) return true
    // With $ address: $w, $W
    if (/^\$[wW]/.test(expr)) return true
    // With regex address: /pattern/w
    if (/\/[^/]*\/[wW]/.test(expr)) return true

    // Execute commands (e/E) with various address forms
    // Bare e/E command
    if (/^[eE]\s/.test(expr) || expr === 'e' || expr === 'E') return true
    // With numeric address
    if (/^\d+[eE]/.test(expr)) return true
    // With address range
    if (/^\d+,\d+[eE]/.test(expr)) return true
    // With $ address
    if (/^\$[eE]/.test(expr)) return true
    // With regex address
    if (/\/[^/]*\/[eE]/.test(expr)) return true

    // Substitution flags containing w/W/e/E
    if (hasSubstitutionFlagDanger(expr)) return true

    // Transliterate (y) command with w/W/e/E anywhere
    if (hasTransliterateDanger(expr)) return true
  }

  return false
}

/**
 * Check for unsafe # comments in a sed expression.
 * A # is safe if it's used as a delimiter in s#...#...# substitution.
 */
function hasUnsafeComment(expr: string): boolean {
  const hashIdx = expr.indexOf('#')
  if (hashIdx === -1) return false

  // If the expression starts with 's' and the delimiter is '#', it's safe
  // s#pattern#replacement#flags
  if (expr.startsWith('s') && expr.length > 1 && expr[1] === '#') {
    return false
  }

  return true
}

/**
 * Check if a substitution expression has dangerous flags (w, W, e, E).
 * These flags in s/pattern/replacement/FLAGS allow writing to files or executing.
 */
function hasSubstitutionFlagDanger(expr: string): boolean {
  if (!expr.startsWith('s') || expr.length < 2) return false

  const delimiter = expr[1]!
  // Find the third delimiter to get the flags
  let pos = 2
  let delimCount = 0

  while (pos < expr.length) {
    if (expr[pos] === '\\' && pos + 1 < expr.length) {
      pos += 2
      continue
    }
    if (expr[pos] === delimiter) {
      delimCount++
      if (delimCount === 2) {
        // Everything after this is flags
        const flags = expr.slice(pos + 1)
        if (/[wWeE]/.test(flags)) return true
        return false
      }
    }
    pos++
  }

  return false
}

/**
 * Check if a transliterate (y) command contains w/W/e/E.
 * y/src/dst/ doesn't have flags, but we check for appended dangerous commands.
 */
function hasTransliterateDanger(expr: string): boolean {
  // Check expressions that start with y (possibly with address prefix)
  // Match: y, \dy, \d,\dy, $y, /pattern/y
  const yMatch = expr.match(/(?:^|\d|,\d|\$|\/)y/)
  if (!yMatch) return false

  // If any w/W/e/E appears after the y command
  const yIdx = expr.indexOf('y', yMatch.index!)
  const afterY = expr.slice(yIdx)
  if (/[wWeE]/.test(afterY)) return true

  return false
}

// ============================================================================
// 7. sedCommandIsAllowedByAllowlist
// ============================================================================

/**
 * Check if a sed command is allowed by the safety allowlist.
 *
 * A command is allowed if:
 * 1. It doesn't contain dangerous operations
 * 2. It's either a line-printing command OR a safe substitution command
 */
export function sedCommandIsAllowedByAllowlist(
  command: string,
  options?: { allowFileWrites?: boolean },
): boolean {
  const expressions = extractSedExpressions(command)

  // No expressions found (possibly due to dangerous flag combos)
  if (expressions.length === 0) return false

  const fileArgs = hasFileArgs(command)

  // Check for dangerous operations
  if (containsDangerousOperations(expressions)) return false

  // Check if it's a safe line-printing command
  if (isLinePrintingCommand(command, expressions)) return true

  // Check if it's a safe substitution command
  if (isSubstitutionCommand(command, expressions, fileArgs, options)) return true

  return false
}

// ============================================================================
// 8. checkSedConstraints
// ============================================================================

/**
 * Main entry point: check sed command security constraints.
 *
 * - Splits compound commands on &&, ||, ;, |
 * - Checks each sed subcommand against the allowlist
 * - In acceptEdits mode, allows -i (in-place editing) flag
 * - Returns 'passthrough' for safe commands, 'ask' for dangerous ones
 */
export function checkSedConstraints(
  input: { command: string },
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  // Split compound commands
  const subcommands = input.command
    .split(/\s*&&\s*|\s*\|\|\s*|\s*;\s*|\s*\|\s*/)
    .map(s => s.trim())
    .filter(Boolean)

  const allowFileWrites = toolPermissionContext.mode === 'acceptEdits'

  for (const sub of subcommands) {
    const baseCommand = sub.trim().split(/\s+/)[0] ?? ''

    // Only check sed commands
    if (baseCommand !== 'sed') continue

    const isAllowed = sedCommandIsAllowedByAllowlist(sub, {
      allowFileWrites,
    })

    if (!isAllowed) {
      return {
        behavior: 'ask',
        message: `sed command requires review: ${sub}`,
      }
    }
  }

  // All sed commands (if any) passed the allowlist
  return {
    behavior: 'passthrough',
    message: 'sed command(s) passed security validation',
  }
}

// ============================================================================
// Internal: command tokenizer
// ============================================================================

/**
 * Tokenize a shell command string into individual tokens.
 *
 * Handles:
 * - Single-quoted strings (no escaping inside)
 * - Double-quoted strings (backslash escaping)
 * - Backslash-escaped characters
 * - Whitespace-separated tokens
 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let i = 0
  let inSingleQuote = false
  let inDoubleQuote = false

  while (i < command.length) {
    const ch = command[i]!

    if (inSingleQuote) {
      if (ch === "'") {
        inSingleQuote = false
      } else {
        current += ch
      }
      i++
      continue
    }

    if (inDoubleQuote) {
      if (ch === '"') {
        inDoubleQuote = false
      } else if (ch === '\\' && i + 1 < command.length) {
        const next = command[i + 1]!
        // In double quotes, only certain chars are special after backslash
        if (next === '"' || next === '\\' || next === '$' || next === '`' || next === '\n') {
          current += next
          i++
        } else {
          current += ch
        }
      } else {
        current += ch
      }
      i++
      continue
    }

    // Outside quotes
    if (ch === "'") {
      inSingleQuote = true
      i++
      continue
    }

    if (ch === '"') {
      inDoubleQuote = true
      i++
      continue
    }

    if (ch === '\\' && i + 1 < command.length) {
      current += command[i + 1]!
      i += 2
      continue
    }

    if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      i++
      continue
    }

    current += ch
    i++
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}
