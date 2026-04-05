/**
 * Bash command security validators.
 *
 * Implements the same 23 security checks as Claude Code's bashSecurity.ts:
 * - Injection detection (command substitution, process substitution, etc.)
 * - Obfuscation detection (ANSI-C quoting, empty quotes, brace expansion)
 * - Parser differential mitigations (CR, unicode whitespace, mid-word hash)
 * - Redirection and newline detection
 * - Zsh dangerous command detection
 *
 * Each validator returns a PermissionResult.
 * The validation chain runs all validators in a specific order.
 */

import type { PermissionResult } from '../../Tool.js'
import {
  CONTROL_CHAR_RE,
  UNICODE_WHITESPACE_RE,
  PROC_ENVIRON_RE,
  type QuoteExtraction,
  extractQuotedContent,
  stripSafeRedirections,
  hasUnescapedChar,
  isEscapedAtPosition,
  ZSH_DANGEROUS_BUILTINS,
} from '../../utils/bash/ast.js'

// ============================================================================
// Security check IDs (for logging/analytics)
// ============================================================================

export const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,
  JQ_SYSTEM_FUNCTION: 2,
  JQ_FILE_ARGUMENTS: 3,
  OBFUSCATED_FLAGS: 4,
  SHELL_METACHARACTERS: 5,
  DANGEROUS_VARIABLES: 6,
  NEWLINES: 7,
  DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION: 8,
  DANGEROUS_PATTERNS_INPUT_REDIRECTION: 9,
  DANGEROUS_PATTERNS_OUTPUT_REDIRECTION: 10,
  IFS_INJECTION: 11,
  GIT_COMMIT_SUBSTITUTION: 12,
  PROC_ENVIRON_ACCESS: 13,
  MALFORMED_TOKEN_INJECTION: 14,
  BACKSLASH_ESCAPED_WHITESPACE: 15,
  BRACE_EXPANSION: 16,
  CONTROL_CHARACTERS: 17,
  UNICODE_WHITESPACE: 18,
  MID_WORD_HASH: 19,
  ZSH_DANGEROUS_COMMANDS: 20,
  BACKSLASH_ESCAPED_OPERATORS: 21,
  COMMENT_QUOTE_DESYNC: 22,
  QUOTED_NEWLINE: 23,
} as const

// ============================================================================
// Command substitution patterns
// ============================================================================

const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /=\(/, message: 'Zsh process substitution =()' },
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion (=cmd)' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /\$\[/, message: '$[] legacy arithmetic expansion' },
  { pattern: /~\[/, message: 'Zsh-style parameter expansion' },
  { pattern: /\(e:/, message: 'Zsh-style glob qualifiers' },
  { pattern: /\(\+/, message: 'Zsh glob qualifier with command execution' },
  { pattern: /\}\s*always\s*\{/, message: 'Zsh always block (try/always construct)' },
  { pattern: /<#/, message: 'PowerShell comment syntax' },
]

const SHELL_OPERATORS = new Set([';', '|', '&', '<', '>'])

// Use the same range as ast.ts UNICODE_WHITESPACE_RE (includes \u200B zero-width space)
const UNICODE_WS_RE = UNICODE_WHITESPACE_RE

// ============================================================================
// Validation context
// ============================================================================

export interface ValidationContext {
  originalCommand: string
  baseCommand: string
  /** Single-quoted content stripped, double-quote delimiters stripped */
  unquotedContent: string
  /** All quoted content stripped, safe redirections stripped */
  fullyUnquotedContent: string
  /** All quoted content stripped, before safe-redirection stripping */
  fullyUnquotedPreStrip: string
  /** Quoted content stripped but quote delimiters preserved */
  unquotedKeepQuoteChars: string
}

function passthrough(message: string): PermissionResult {
  return { behavior: 'passthrough', message }
}

function ask(message: string): PermissionResult {
  return { behavior: 'ask', message }
}

function allow(command: string, reason: string): PermissionResult {
  return { behavior: 'allow', updatedInput: { command } }
}

// ============================================================================
// Individual validators
// ============================================================================

export function validateEmpty(ctx: ValidationContext): PermissionResult {
  if (!ctx.originalCommand.trim()) {
    return allow(ctx.originalCommand, 'Empty command is safe')
  }
  return passthrough('Command is not empty')
}

export function validateIncompleteCommands(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx
  const trimmed = originalCommand.trim()

  if (/^\s*\t/.test(originalCommand)) {
    return ask('Command appears to be an incomplete fragment (starts with tab)')
  }
  if (trimmed.startsWith('-')) {
    return ask('Command appears to be an incomplete fragment (starts with flags)')
  }
  if (/^\s*(&&|\|\||;|>>?|<)/.test(originalCommand)) {
    return ask('Command appears to be a continuation line (starts with operator)')
  }
  return passthrough('Command appears complete')
}

const HEREDOC_IN_SUBSTITUTION = /\$\(.*<</

/**
 * Check if a command containing heredoc-in-substitution is provably safe.
 *
 * Safe pattern: `cmd $(cat <<'DELIM'\n...\nDELIM\n) args`
 * Requirements:
 * 1. Delimiter must be single-quoted or backslash-escaped (no expansion in body)
 * 2. Closing delimiter must be on its own line (or DELIM) form)
 * 3. Non-whitespace text before $( (argument position, not command name)
 * 4. Remaining text (with heredoc stripped) passes all validators
 * 5. Remaining text character set is restricted (no shell metacharacters)
 * 6. No nested matches
 */
function isSafeHeredoc(command: string): boolean {
  if (!HEREDOC_IN_SUBSTITUTION.test(command)) return false

  // Find all safe heredoc patterns: $(cat <<'DELIM' or $(cat <<\DELIM
  const heredocPattern = /\$\(cat[ \t]*<<(-?)[ \t]*(?:'+([A-Za-z_]\w*)'+|\\([A-Za-z_]\w*))/g
  const matches: Array<{ start: number; operatorEnd: number; delimiter: string; isDash: boolean }> = []

  let match: RegExpExecArray | null
  while ((match = heredocPattern.exec(command)) !== null) {
    matches.push({
      start: match.index,
      operatorEnd: match.index + match[0].length,
      delimiter: match[2] ?? match[3] ?? '',
      isDash: match[1] === '-',
    })
  }

  if (matches.length === 0) return false

  // Verify each heredoc's closing delimiter
  const verified: Array<{ start: number; end: number }> = []

  for (const m of matches) {
    const afterOperator = command.slice(m.operatorEnd)
    const firstNewline = afterOperator.indexOf('\n')
    if (firstNewline === -1) continue

    // Validate opening line has only whitespace
    const openingLine = afterOperator.slice(0, firstNewline)
    if (!/^[ \t]*$/.test(openingLine)) continue

    // Find closing delimiter line-by-line
    const bodyStart = m.operatorEnd + firstNewline + 1
    const body = command.slice(bodyStart)
    const lines = body.split('\n')
    let closingLineIndex = -1
    let endPos = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const checkLine = m.isDash ? line.replace(/^\t*/, '') : line

      // Form 1: delimiter alone on line
      if (checkLine === m.delimiter) {
        closingLineIndex = i
        // End position: after delimiter line + the `)` on next line or same line
        const linesUpToClosing = lines.slice(0, i + 1)
        const bodyLength = linesUpToClosing.join('\n').length
        endPos = bodyStart + bodyLength

        // Look for `)` after the delimiter
        const afterClose = command.slice(endPos)
        const closeMatch = afterClose.match(/^\s*\)/)
        if (closeMatch) {
          endPos += closeMatch[0].length
        }
        break
      }

      // Form 2: DELIM) on same line (PST_EOFTOKEN)
      if (checkLine.startsWith(m.delimiter) && checkLine.length > m.delimiter.length) {
        const charAfter = checkLine[m.delimiter.length]!
        if (charAfter === ')') {
          closingLineIndex = i
          const linesUpToClosing = lines.slice(0, i + 1)
          const bodyLength = linesUpToClosing.join('\n').length
          // Include the ) character
          endPos = bodyStart + bodyLength - (lines[i]!.length - m.delimiter.length - 1)
          break
        }
        // If followed by shell metacharacter, bail
        if (/^[)}`|&;(<>]$/.test(charAfter)) break
      }
    }

    if (closingLineIndex === -1 || endPos === -1) continue

    verified.push({ start: m.start, end: endPos })
  }

  if (verified.length === 0) return false

  // Reject nested matches
  for (let i = 0; i < verified.length; i++) {
    for (let j = 0; j < verified.length; j++) {
      if (i === j) continue
      if (verified[i]!.start > verified[j]!.start && verified[i]!.start < verified[j]!.end) {
        return false
      }
    }
  }

  // Strip all verified heredocs (reverse order to preserve indices)
  const sorted = [...verified].sort((a, b) => b.start - a.start)
  let remaining = command
  for (const { start, end } of sorted) {
    remaining = remaining.slice(0, start) + remaining.slice(end)
  }

  // Validate prefix: $() must be in argument position (non-empty text before first heredoc)
  const trimmedRemaining = remaining.trim()
  if (trimmedRemaining.length > 0) {
    const firstStart = Math.min(...verified.map(v => v.start))
    const prefix = command.slice(0, firstStart)
    if (prefix.trim().length === 0) {
      return false // $() in command-name position
    }
  }

  // Validate remaining text character set (no shell metacharacters)
  if (!/^[a-zA-Z0-9 \t"'.\-/_@=,:+~]*$/.test(remaining)) return false

  // Recursive validation: remaining text must pass all security validators
  if (bashCommandIsSafe(remaining).behavior !== 'passthrough') return false

  return true
}

export function validateSafeCommandSubstitution(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx

  if (!HEREDOC_IN_SUBSTITUTION.test(originalCommand)) {
    return passthrough('No heredoc in substitution')
  }

  if (isSafeHeredoc(originalCommand)) {
    return allow(originalCommand, 'Safe command substitution: cat with quoted/escaped heredoc delimiter')
  }

  return passthrough('Command substitution needs validation')
}

export function validateGitCommit(ctx: ValidationContext): PermissionResult {
  const { originalCommand, baseCommand } = ctx

  if (baseCommand !== 'git' || !/^git\s+commit\s+/.test(originalCommand)) {
    return passthrough('Not a git commit')
  }

  if (originalCommand.includes('\\')) {
    return passthrough('Git commit contains backslash, needs full validation')
  }

  const messageMatch = originalCommand.match(
    /^git[ \t]+commit[ \t]+[^;&|`$<>()\n\r]*?-m[ \t]+(["'])([\s\S]*?)\1(.*)$/,
  )

  if (messageMatch) {
    const [, quote, messageContent, remainder] = messageMatch

    // Command substitution in double-quoted message
    if (quote === '"' && messageContent && /\$\(|`|\$\{/.test(messageContent)) {
      return ask('Git commit message contains command substitution patterns')
    }

    // Shell operators in remainder
    if (remainder && /[;|&()`]|\$\(|\$\{/.test(remainder)) {
      return passthrough('Git commit remainder contains shell metacharacters')
    }

    // Unquoted redirects in remainder
    if (remainder) {
      let unquoted = ''
      let inSQ = false
      let inDQ = false
      for (let i = 0; i < remainder.length; i++) {
        const c = remainder[i]!
        if (c === "'" && !inDQ) { inSQ = !inSQ; continue }
        if (c === '"' && !inSQ) { inDQ = !inDQ; continue }
        if (!inSQ && !inDQ) unquoted += c
      }
      if (/[<>]/.test(unquoted)) {
        return passthrough('Git commit remainder contains unquoted redirect operator')
      }
    }

    // Message starts with dash
    if (messageContent && messageContent.startsWith('-')) {
      return ask('Command contains quoted characters in flag names')
    }

    return allow(originalCommand, 'Git commit with simple quoted message is allowed')
  }

  return passthrough('Git commit needs validation')
}

export function validateJqCommand(ctx: ValidationContext): PermissionResult {
  const { originalCommand, baseCommand } = ctx

  if (baseCommand !== 'jq') return passthrough('Not jq')

  if (/\bsystem\s*\(/.test(originalCommand)) {
    return ask('jq command contains system() function which executes arbitrary commands')
  }

  const afterJq = originalCommand.substring(3).trim()
  if (/(?:^|\s)(?:-f\b|--from-file|--rawfile|--slurpfile|-L\b|--library-path)/.test(afterJq)) {
    return ask('jq command contains dangerous flags that could execute code or read arbitrary files')
  }

  return passthrough('jq command is safe')
}

export function validateObfuscatedFlags(ctx: ValidationContext): PermissionResult {
  const { originalCommand, unquotedContent } = ctx

  // ANSI-C quoting — check original command (quotes not yet stripped)
  if (/\$'[^']*'/.test(originalCommand)) {
    return ask('Command contains ANSI-C quoting ($\'...\') which can encode arbitrary characters')
  }

  // Locale quoting — check original command
  if (/\$"[^"]*"/.test(originalCommand)) {
    return ask('Command contains locale quoting ($"...") which can encode arbitrary characters')
  }

  // Empty quotes before dash
  if (/\$['"]{2}\s*-/.test(originalCommand)) {
    return ask('Command contains empty quotes before a flag which could obfuscate the flag name')
  }

  // Homogeneous empty quote pairs before dash
  if (/(?:^|\s)(?:''|"")+\s*-/.test(originalCommand)) {
    return ask('Command contains empty quote pairs before a flag which could obfuscate the flag name')
  }

  // Empty pair + quote + dash ("""-f" pattern)
  if (/(?:""|'')+['"]-/.test(originalCommand)) {
    return ask('Command contains concatenated empty quotes with a flag')
  }

  // 3+ consecutive quotes at word start
  if (/(?:^|\s)['"]{3,}/.test(originalCommand)) {
    return ask('Command contains excessive consecutive quotes that could obfuscate flags')
  }

  return passthrough('No obfuscated flags')
}

export function validateShellMetacharacters(ctx: ValidationContext): PermissionResult {
  const { unquotedContent } = ctx

  // Quoted content with metacharacters
  if (/(?:^|\s)["'][^"']*[;&][^"']*["'](?:\s|$)/.test(unquotedContent)) {
    return ask('Command contains shell metacharacters (;, |, or &) in arguments')
  }

  // find -name/-path/-iname with metacharacters
  if (
    /-name\s+["'][^"']*[;|&][^"']*["']/.test(unquotedContent) ||
    /-path\s+["'][^"']*[;|&][^"']*["']/.test(unquotedContent) ||
    /-iname\s+["'][^"']*[;|&][^"']*["']/.test(unquotedContent)
  ) {
    return ask('Command contains shell metacharacters (;, |, or &) in arguments')
  }

  // find -regex with metacharacters
  if (/-regex\s+["'][^"']*[;&][^"']*["']/.test(unquotedContent)) {
    return ask('Command contains shell metacharacters (;, |, or &) in arguments')
  }

  return passthrough('No metacharacters')
}

export function validateDangerousVariables(ctx: ValidationContext): PermissionResult {
  const { fullyUnquotedContent } = ctx

  if (
    /[<>|]\s*\$[A-Za-z_]/.test(fullyUnquotedContent) ||
    /\$[A-Za-z_][A-Za-z0-9_]*\s*[|<>]/.test(fullyUnquotedContent)
  ) {
    return ask('Command contains variables in dangerous contexts (redirections or pipes)')
  }

  return passthrough('No dangerous variables')
}

export function validateCommentQuoteDesync(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx

  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < originalCommand.length; i++) {
    const char = originalCommand[i]!

    if (escaped) { escaped = false; continue }

    if (inSingleQuote) {
      if (char === "'") inSingleQuote = false
      continue
    }

    if (char === '\\') { escaped = true; continue }

    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false
      continue
    }

    if (char === "'") { inSingleQuote = true; continue }
    if (char === '"') { inDoubleQuote = true; continue }

    // Unquoted # starts a comment
    if (char === '#') {
      const lineEnd = originalCommand.indexOf('\n', i)
      const commentText = originalCommand.slice(i + 1, lineEnd === -1 ? originalCommand.length : lineEnd)
      if (/['"]/.test(commentText)) {
        return ask('Command contains quote characters inside a # comment which can desync quote tracking')
      }
      if (lineEnd === -1) break
      i = lineEnd
    }
  }

  return passthrough('No comment quote desync')
}

export function validateQuotedNewline(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx

  if (!originalCommand.includes('\n') || !originalCommand.includes('#')) {
    return passthrough('No newline or no hash')
  }

  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < originalCommand.length; i++) {
    const char = originalCommand[i]!

    if (escaped) { escaped = false; continue }
    if (char === '\\' && !inSingleQuote) { escaped = true; continue }
    if (char === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; continue }
    if (char === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue }

    // Newline inside quotes
    if (char === '\n' && (inSingleQuote || inDoubleQuote)) {
      const lineStart = i + 1
      const nextNewline = originalCommand.indexOf('\n', lineStart)
      const lineEnd = nextNewline === -1 ? originalCommand.length : nextNewline
      const nextLine = originalCommand.slice(lineStart, lineEnd)
      if (nextLine.trim().startsWith('#')) {
        return ask('Command contains a quoted newline followed by a #-prefixed line, which can hide arguments from line-based permission checks')
      }
    }
  }

  return passthrough('No quoted newline-hash pattern')
}

export function validateCarriageReturn(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx

  if (!originalCommand.includes('\r')) return passthrough('No carriage return')

  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < originalCommand.length; i++) {
    const c = originalCommand[i]!
    if (escaped) { escaped = false; continue }
    if (c === '\\' && !inSingleQuote) { escaped = true; continue }
    if (c === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; continue }
    if (c === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue }

    if (c === '\r' && !inDoubleQuote) {
      return ask('Command contains carriage return (\\r) which shell-quote and bash tokenize differently')
    }
  }

  return passthrough('CR only inside double quotes')
}

export function validateNewlines(ctx: ValidationContext): PermissionResult {
  const { fullyUnquotedPreStrip } = ctx

  if (!/[\n\r]/.test(fullyUnquotedPreStrip)) return passthrough('No newlines')

  // Newline NOT preceded by space+backslash, followed by non-whitespace
  if (/(?<![\s]\\)[\n\r]\s*\S/.test(fullyUnquotedPreStrip)) {
    return ask('Command contains newlines that could separate multiple commands')
  }

  return passthrough('Newlines appear to be within data')
}

export function validateIFSInjection(ctx: ValidationContext): PermissionResult {
  if (/\$IFS|\$\{[^}]*IFS/.test(ctx.originalCommand)) {
    return ask('Command contains IFS variable usage which could bypass security validation')
  }
  return passthrough('No IFS injection detected')
}

export function validateProcEnvironAccess(ctx: ValidationContext): PermissionResult {
  if (PROC_ENVIRON_RE.test(ctx.originalCommand)) {
    return ask('Command accesses /proc/*/environ which could expose sensitive environment variables')
  }
  return passthrough('No /proc/environ access detected')
}

export function validateDangerousPatterns(ctx: ValidationContext): PermissionResult {
  const { unquotedContent } = ctx

  // Unescaped backticks
  if (hasUnescapedChar(unquotedContent, '`')) {
    return ask('Command contains backticks (`) for command substitution')
  }

  // Other command substitution patterns
  for (const { pattern, message } of COMMAND_SUBSTITUTION_PATTERNS) {
    if (pattern.test(unquotedContent)) {
      return ask(`Command contains ${message}`)
    }
  }

  return passthrough('No dangerous patterns')
}

export function validateRedirections(ctx: ValidationContext): PermissionResult {
  const { fullyUnquotedContent } = ctx

  if (/</.test(fullyUnquotedContent)) {
    return ask('Command contains input redirection (<) which could read sensitive files')
  }
  if (/>/.test(fullyUnquotedContent)) {
    return ask('Command contains output redirection (>) which could write to arbitrary files')
  }

  return passthrough('No redirections')
}

export function validateBackslashEscapedWhitespace(ctx: ValidationContext): PermissionResult {
  if (hasBackslashEscapedWhitespace(ctx.originalCommand)) {
    return ask('Command contains backslash-escaped whitespace that could alter command parsing')
  }
  return passthrough('No backslash-escaped whitespace')
}

function hasBackslashEscapedWhitespace(command: string): boolean {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < command.length; i++) {
    const c = command[i]!

    if (inSingleQuote) {
      if (c === "'") inSingleQuote = false
      continue
    }

    if (c === '\\' && !inDoubleQuote) {
      const next = command[i + 1]
      if (next === ' ' || next === '\t') return true
      i++ // skip escaped char
      continue
    }

    if (c === '\\' && inDoubleQuote) {
      i++ // skip escaped char
      continue
    }

    if (c === "'" && !inDoubleQuote) { inSingleQuote = true; continue }
    if (c === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue }
  }

  return false
}

export function validateBackslashEscapedOperators(ctx: ValidationContext): PermissionResult {
  if (hasBackslashEscapedOperator(ctx.originalCommand)) {
    return ask('Command contains a backslash before a shell operator (;, |, &, <, >) which can hide command structure')
  }
  return passthrough('No backslash-escaped operators')
}

function hasBackslashEscapedOperator(command: string): boolean {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < command.length; i++) {
    const c = command[i]!

    // Process backslash BEFORE quote toggles
    if (c === '\\' && !inSingleQuote) {
      const next = command[i + 1]
      if (next && SHELL_OPERATORS.has(next) && !inDoubleQuote) {
        return true
      }
      if (next && inDoubleQuote && SHELL_OPERATORS.has(next)) {
        // Inside double quotes, \; etc. are different — but \| and \& still suspect
        // For safety, flag any escaped operator inside double quotes too
      }
      i++ // skip next char
      continue
    }

    if (inSingleQuote) {
      if (c === "'") inSingleQuote = false
      continue
    }

    if (c === "'" && !inDoubleQuote) { inSingleQuote = true; continue }
    if (c === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue }
  }

  return false
}

export function validateUnicodeWhitespace(ctx: ValidationContext): PermissionResult {
  if (UNICODE_WS_RE.test(ctx.originalCommand)) {
    return ask('Command contains Unicode whitespace characters that could cause parsing inconsistencies')
  }
  return passthrough('No Unicode whitespace')
}

export function validateMidWordHash(ctx: ValidationContext): PermissionResult {
  const { unquotedKeepQuoteChars } = ctx

  // Join line continuations
  const joined = unquotedKeepQuoteChars.replace(/\\+\n/g, match => {
    const backslashCount = match.length - 1
    return backslashCount % 2 === 1 ? '\\'.repeat(backslashCount - 1) : match
  })

  // Non-whitespace (not ${) immediately before #
  if (/\S(?<!\$\{)#/.test(unquotedKeepQuoteChars) || /\S(?<!\$\{)#/.test(joined)) {
    return ask('Command contains mid-word # which is parsed differently by shell-quote vs bash')
  }
  return passthrough('No mid-word hash')
}

export function validateBraceExpansion(ctx: ValidationContext): PermissionResult {
  const content = ctx.fullyUnquotedPreStrip

  // Check for mismatched brace counts
  let openBraces = 0
  let closeBraces = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{' && !isEscapedAtPosition(content, i)) openBraces++
    else if (content[i] === '}' && !isEscapedAtPosition(content, i)) closeBraces++
  }

  // Excess closing braces → quoted brace was stripped
  if (openBraces > 0 && closeBraces > openBraces) {
    return ask('Command has excess closing braces after quote stripping, indicating possible brace expansion obfuscation')
  }

  // Quoted brace inside unquoted brace context
  if (openBraces > 0 && /['"][{}]['"]/.test(ctx.originalCommand)) {
    return ask('Command contains quoted brace character inside brace context (potential brace expansion obfuscation)')
  }

  // Scan for actual brace expansion patterns (comma or ..)
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '{' || isEscapedAtPosition(content, i)) continue

    // Find matching close brace with depth tracking
    let depth = 1
    let matchingClose = -1
    for (let j = i + 1; j < content.length; j++) {
      if (content[j] === '{' && !isEscapedAtPosition(content, j)) depth++
      else if (content[j] === '}' && !isEscapedAtPosition(content, j)) {
        depth--
        if (depth === 0) { matchingClose = j; break }
      }
    }
    if (matchingClose === -1) continue

    // Check for comma or .. at outermost nesting level
    let innerDepth = 0
    for (let k = i + 1; k < matchingClose; k++) {
      if (content[k] === '{' && !isEscapedAtPosition(content, k)) innerDepth++
      else if (content[k] === '}' && !isEscapedAtPosition(content, k)) innerDepth--
      else if (innerDepth === 0) {
        if (content[k] === ',' || (content[k] === '.' && k + 1 < matchingClose && content[k + 1] === '.')) {
          return ask('Command contains brace expansion that could alter command parsing')
        }
      }
    }
  }

  return passthrough('No brace expansion detected')
}

export function validateZshDangerousCommands(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx
  const ZSH_PRECOMMAND_MODIFIERS = new Set(['command', 'builtin', 'noglob', 'nocorrect'])

  const trimmed = originalCommand.trim()
  const tokens = trimmed.split(/\s+/)
  let baseCmd = ''
  for (const token of tokens) {
    if (/^[A-Za-z_]\w*=/.test(token)) continue
    if (ZSH_PRECOMMAND_MODIFIERS.has(token)) continue
    baseCmd = token
    break
  }

  if (ZSH_DANGEROUS_BUILTINS.has(baseCmd)) {
    return ask(`Command uses Zsh-specific '${baseCmd}' which can bypass security checks`)
  }

  // fc -e (editor execution)
  if (baseCmd === 'fc' && /\s-\S*e/.test(trimmed)) {
    return ask("Command uses 'fc -e' which can execute arbitrary commands via editor")
  }

  return passthrough('No Zsh dangerous commands')
}

export function validateMalformedTokenInjection(ctx: ValidationContext): PermissionResult {
  const { originalCommand } = ctx

  // Simple check: if command has operators AND unbalanced delimiters → suspicious
  const hasOperator = /[;&]|&&|\|\|/.test(originalCommand)
  if (!hasOperator) return passthrough('No command separators')

  // Check for unbalanced quotes/parens/brackets
  let singles = 0, doubles = 0, parens = 0, brackets = 0
  let escaped = false
  for (let i = 0; i < originalCommand.length; i++) {
    const c = originalCommand[i]!
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === "'") singles++
    else if (c === '"') doubles++
    else if (c === '(') parens++
    else if (c === ')') parens--
    else if (c === '[') brackets++
    else if (c === ']') brackets--
  }

  if (singles % 2 !== 0 || doubles % 2 !== 0 || parens !== 0 || brackets !== 0) {
    return ask('Command contains ambiguous syntax with command separators that could be misinterpreted')
  }

  return passthrough('No malformed token injection detected')
}

// ============================================================================
// Main validation chain
// ============================================================================

/** Validators that can short-circuit with 'allow' */
const EARLY_VALIDATORS = [
  validateEmpty,
  validateIncompleteCommands,
  validateSafeCommandSubstitution,
  validateGitCommit,
]

/** Main validators in exact order */
const MAIN_VALIDATORS = [
  validateJqCommand,
  validateObfuscatedFlags,
  validateShellMetacharacters,
  validateDangerousVariables,
  validateCommentQuoteDesync,
  validateQuotedNewline,
  validateCarriageReturn,
  validateNewlines,
  validateIFSInjection,
  validateProcEnvironAccess,
  validateDangerousPatterns,
  validateRedirections,
  validateBackslashEscapedWhitespace,
  validateBackslashEscapedOperators,
  validateUnicodeWhitespace,
  validateMidWordHash,
  validateBraceExpansion,
  validateZshDangerousCommands,
  validateMalformedTokenInjection,
]

/** Non-misparsing validators whose results are deferred */
const NON_MISPARSING_VALIDATORS = new Set<Function>([
  validateNewlines,
  validateRedirections,
])

/**
 * Run all bash security validators on a command.
 *
 * Returns 'allow' (early allow), 'ask' (blocked), or 'passthrough' (all checks passed).
 */
export function bashCommandIsSafe(command: string): PermissionResult {
  // Pre-check: control characters
  if (CONTROL_CHAR_RE.test(command)) {
    return ask('Command contains non-printable control characters that could be used to bypass security checks')
  }

  // Extract quoted content for validators
  const baseCommand = (command.trim().split(/\s+/)[0] || '').replace(/^.*\//, '')
  const quoteExtraction = extractQuotedContent(command, baseCommand === 'jq')
  const fullyUnquotedContent = stripSafeRedirections(quoteExtraction.fullyUnquoted)

  const ctx: ValidationContext = {
    originalCommand: command,
    baseCommand,
    unquotedContent: quoteExtraction.withDoubleQuotes,
    fullyUnquotedContent,
    fullyUnquotedPreStrip: quoteExtraction.fullyUnquoted,
    unquotedKeepQuoteChars: quoteExtraction.unquotedKeepQuoteChars,
  }

  // Early validators (can short-circuit with 'allow')
  for (const validator of EARLY_VALIDATORS) {
    const result = validator(ctx)
    if (result.behavior === 'allow') return result
    if (result.behavior === 'ask') return result
  }

  // Main validators
  let deferredNonMisparsingResult: PermissionResult | null = null

  for (const validator of MAIN_VALIDATORS) {
    const result = validator(ctx)
    if (result.behavior === 'ask') {
      if (NON_MISPARSING_VALIDATORS.has(validator)) {
        if (deferredNonMisparsingResult === null) {
          deferredNonMisparsingResult = result
        }
        continue
      }
      return result
    }
  }

  // Return deferred non-misparsing result if any
  if (deferredNonMisparsingResult !== null) {
    return deferredNonMisparsingResult
  }

  return passthrough('Command passed all security checks')
}
