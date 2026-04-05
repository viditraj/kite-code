/**
 * Main bash permission engine.
 *
 * Orchestrates all bash security layers:
 * 1. Rule matching (deny/ask/allow with env-var stripping)
 * 2. Security validators (23 checks from bashSecurity.ts)
 * 3. Path constraints (pathValidation.ts)
 * 4. Read-only detection (readOnlyValidation.ts)
 * 5. Sed constraints (sedValidation.ts)
 * 6. Mode validation (modeValidation.ts)
 *
 * Implements the same logic as Claude Code's bashPermissions.ts:
 * - SAFE_BASH_ENV_VARS for env-var stripping in rule matching
 * - Wrapper command stripping (timeout, time, nice, nohup, stdbuf)
 * - Compound command handling (prefix rules don't match compounds)
 * - Suggestion generation for permission prompts
 */

import type { PermissionResult } from '../../Tool.js'
import type { ToolPermissionContext, PermissionRuleValue } from '../../types/permissions.js'
import { permissionRuleValueFromString } from '../../utils/permissions/permissionRuleParser.js'
import {
  matchWildcardPattern,
  hasWildcards,
  permissionRuleExtractPrefix,
} from '../../utils/permissions/shellRuleMatching.js'
import { getRuleByContentsForTool } from '../../utils/permissions/permissions.js'
import { splitCommand } from '../../utils/bash/commands.js'
import { bashCommandIsSafe } from './bashSecurity.js'

// ============================================================================
// Safe environment variables for permission rule matching
// ============================================================================

/**
 * Environment variables safe to strip from commands before rule matching.
 * These CANNOT execute code or load libraries.
 */
const SAFE_BASH_ENV_VARS = new Set([
  // Go
  'GOEXPERIMENT', 'GOOS', 'GOARCH', 'CGO_ENABLED', 'GO111MODULE',
  // Rust
  'RUST_BACKTRACE', 'RUST_LOG',
  // Node
  'NODE_ENV',
  // Python
  'PYTHONUNBUFFERED', 'PYTHONDONTWRITEBYTECODE',
  // Pytest
  'PYTEST_DISABLE_PLUGIN_AUTOLOAD', 'PYTEST_DEBUG',
  // API keys
  'ANTHROPIC_API_KEY',
  // Locale/encoding
  'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'LC_TIME', 'CHARSET',
  // Terminal/display
  'TERM', 'COLORTERM', 'NO_COLOR', 'FORCE_COLOR', 'TZ',
  // Colors
  'LS_COLORS', 'LSCOLORS', 'GREP_COLOR', 'GREP_COLORS', 'GCC_COLORS',
  // Display
  'TIME_STYLE', 'BLOCK_SIZE', 'BLOCKSIZE',
])

/**
 * Commands that should NEVER be suggested as prefix rules (too dangerous).
 */
const BARE_SHELL_PREFIXES = new Set([
  'sh', 'bash', 'zsh', 'fish', 'csh', 'tcsh', 'ksh', 'dash', 'cmd', 'powershell', 'pwsh',
  'env', 'xargs',
  'nice', 'stdbuf', 'nohup', 'timeout', 'time',
  'sudo', 'doas', 'pkexec',
])

// ============================================================================
// Env var patterns
// ============================================================================

/** Pattern for safe env var assignments (restrictive value charset) */
const SAFE_ENV_VAR_RE = /^([A-Za-z_][A-Za-z0-9_]*)=([A-Za-z0-9_./:-]+)[ \t]+/

/**
 * Aggressive env var pattern for deny/ask rules.
 * Handles quoted values, concatenation, and array subscripts.
 */
const AGGRESSIVE_ENV_VAR_RE = /^([A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?)\+?=(?:'[^'\n\r]*'|"(?:\\.|[^"$`\\\n\r])*"|\\.|[^ \t\n\r$`;|&()<>\\\\'"])*[ \t]+/

// ============================================================================
// Env var stripping
// ============================================================================

/**
 * Strip leading safe env vars from a command.
 * Only strips vars in SAFE_BASH_ENV_VARS.
 * Used for allow rule matching.
 */
export function stripSafeEnvVars(command: string): string {
  let result = command
  while (true) {
    const match = result.match(SAFE_ENV_VAR_RE)
    if (!match) break
    const varName = match[1]!
    if (!SAFE_BASH_ENV_VARS.has(varName)) break
    result = result.slice(match[0].length)
  }
  return result
}

/**
 * Aggressively strip ALL leading env vars.
 * Used for deny/ask rule matching (prevents bypass via FOO=bar denied_cmd).
 */
export function stripAllLeadingEnvVars(command: string): string {
  let result = command
  while (true) {
    const match = result.match(AGGRESSIVE_ENV_VAR_RE)
    if (!match) break
    result = result.slice(match[0].length)
  }
  return result
}

// ============================================================================
// Wrapper command stripping
// ============================================================================

/**
 * Strip wrapper commands (timeout, time, nice, nohup, stdbuf)
 * and leading safe env vars for permission matching.
 */
export function stripSafeWrappers(command: string): string {
  let result = stripSafeEnvVars(command)

  // timeout
  const timeoutMatch = result.match(/^timeout\s+/)
  if (timeoutMatch) {
    let rest = result.slice(timeoutMatch[0].length)
    // Skip timeout flags
    while (true) {
      if (/^--foreground\s+/.test(rest)) { rest = rest.replace(/^--foreground\s+/, ''); continue }
      if (/^--preserve-status\s+/.test(rest)) { rest = rest.replace(/^--preserve-status\s+/, ''); continue }
      if (/^--verbose\s+/.test(rest)) { rest = rest.replace(/^--verbose\s+/, ''); continue }
      if (/^-v\s+/.test(rest)) { rest = rest.replace(/^-v\s+/, ''); continue }
      if (/^--kill-after[= ]\S+\s+/.test(rest)) { rest = rest.replace(/^--kill-after[= ]\S+\s+/, ''); continue }
      if (/^-k\s+\S+\s+/.test(rest)) { rest = rest.replace(/^-k\s+\S+\s+/, ''); continue }
      if (/^--signal[= ]\S+\s+/.test(rest)) { rest = rest.replace(/^--signal[= ]\S+\s+/, ''); continue }
      if (/^-s\s+\S+\s+/.test(rest)) { rest = rest.replace(/^-s\s+\S+\s+/, ''); continue }
      break
    }
    // Skip duration
    if (/^\d+(?:\.\d+)?[smhd]?\s+/.test(rest)) {
      rest = rest.replace(/^\d+(?:\.\d+)?[smhd]?\s+/, '')
      result = rest
    }
  }

  // time
  result = result.replace(/^time[ \t]+(?:--[ \t]+)?/, '')

  // nice
  if (/^nice\s+/.test(result)) {
    let rest = result.replace(/^nice\s+/, '')
    if (/^-n\s+\S+\s+/.test(rest)) {
      rest = rest.replace(/^-n\s+\S+\s+/, '')
    } else if (/^-\d+\s+/.test(rest)) {
      rest = rest.replace(/^-\d+\s+/, '')
    }
    result = rest
  }

  // nohup
  result = result.replace(/^nohup[ \t]+/, '')

  // stdbuf (fused short flags only)
  if (/^stdbuf\s+/.test(result)) {
    let rest = result.replace(/^stdbuf\s+/, '')
    while (/^-[ioe].\s+/.test(rest)) {
      rest = rest.replace(/^-[ioe].\s+/, '')
    }
    result = rest
  }

  return result
}

// ============================================================================
// Output redirection stripping
// ============================================================================

/**
 * Strip output redirections from a command for rule matching.
 */
export function stripOutputRedirections(command: string): string {
  return command
    .replace(/\s+2\s*>&\s*1(?=\s|$)/g, '')
    .replace(/\s+[012]?\s*>>?\s+\S+$/g, '')
    .trim()
}

// ============================================================================
// Command prefix extraction
// ============================================================================

/**
 * Extract a stable 2-word command prefix for reusable rules.
 * Skips leading safe env var assignments.
 * Returns null if not a safe prefix.
 */
export function getSimpleCommandPrefix(command: string): string | null {
  const stripped = stripSafeEnvVars(command.trim())
  const tokens = stripped.split(/\s+/)
  if (tokens.length < 1) return null

  const firstWord = tokens[0]!
  if (BARE_SHELL_PREFIXES.has(firstWord)) return null

  if (tokens.length >= 2) {
    const secondWord = tokens[1]!
    // Second token must be lowercase alphanumeric (not a flag/number/path)
    if (/^[a-z][a-z0-9-]*$/.test(secondWord)) {
      return `${firstWord} ${secondWord}`
    }
  }

  return firstWord
}

// ============================================================================
// Rule matching
// ============================================================================

interface MatchResult {
  matched: boolean
  rule?: { source: string; ruleContent: string }
}

/**
 * Match a command against permission rules with stripping variations.
 */
function matchCommandAgainstRules(
  command: string,
  rules: Map<string, { source: string; ruleBehavior: string; ruleValue: PermissionRuleValue }>,
  isAllowRule: boolean,
): MatchResult {
  // Prepare command variants
  const stripped = stripOutputRedirections(command)
  const variants = [command, stripped]

  // For each variant, try with/without safe wrappers
  const allVariants: string[] = []
  for (const v of variants) {
    allVariants.push(v)
    const unwrapped = stripSafeWrappers(v)
    if (unwrapped !== v) allVariants.push(unwrapped)

    // For deny/ask rules: also aggressive env stripping
    if (!isAllowRule) {
      const aggressive = stripAllLeadingEnvVars(v)
      if (aggressive !== v) allVariants.push(aggressive)
      const aggressiveUnwrapped = stripSafeWrappers(aggressive)
      if (aggressiveUnwrapped !== aggressive) allVariants.push(aggressiveUnwrapped)
    }
  }

  // Check compound status (prefix rules don't match compounds)
  const isCompound = splitCommand(command).length > 1

  for (const [ruleContent, rule] of rules) {
    for (const variant of allVariants) {
      // Exact match
      if (variant === ruleContent) {
        return { matched: true, rule: { source: rule.source, ruleContent } }
      }

      // Prefix match (only for non-compound commands)
      if (!isCompound) {
        const prefix = permissionRuleExtractPrefix(ruleContent)
        if (prefix !== null) {
          if (variant === prefix || variant.startsWith(prefix + ' ')) {
            return { matched: true, rule: { source: rule.source, ruleContent } }
          }
        }

        // Wildcard match
        if (hasWildcards(ruleContent)) {
          if (matchWildcardPattern(ruleContent, variant)) {
            return { matched: true, rule: { source: rule.source, ruleContent } }
          }
        }
      }
    }
  }

  return { matched: false }
}

// ============================================================================
// Main permission check
// ============================================================================

/**
 * Main bash tool permission check.
 *
 * Priority order:
 * 1. Exact/prefix/wildcard deny rules → DENY
 * 2. Exact/prefix/wildcard ask rules → ASK
 * 3. Security validators (bashCommandIsSafe)
 * 4. Path constraints
 * 5. Sed constraints
 * 6. Mode validation
 * 7. Read-only detection → ALLOW
 * 8. Exact/prefix/wildcard allow rules → ALLOW
 * 9. Passthrough → ASK (with suggestions)
 */
export function bashToolCheckPermission(
  command: string,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  // Get content-specific rules for Bash tool
  const denyRules = getRuleByContentsForTool(toolPermissionContext, 'Bash', 'deny')
  const askRules = getRuleByContentsForTool(toolPermissionContext, 'Bash', 'ask')
  const allowRules = getRuleByContentsForTool(toolPermissionContext, 'Bash', 'allow')

  // Step 1: Check deny rules
  const denyMatch = matchCommandAgainstRules(command, denyRules as any, false)
  if (denyMatch.matched) {
    return {
      behavior: 'deny',
      message: `Command denied by rule: ${denyMatch.rule?.ruleContent}`,
    }
  }

  // Step 2: Check ask rules
  const askMatch = matchCommandAgainstRules(command, askRules as any, false)
  if (askMatch.matched) {
    return {
      behavior: 'ask',
      message: `Command requires approval (rule: ${askMatch.rule?.ruleContent})`,
    }
  }

  // Step 3: Security validators
  const securityResult = bashCommandIsSafe(command)
  if (securityResult.behavior === 'ask') {
    return securityResult
  }

  // Step 4-6: Path constraints, sed constraints, mode validation
  // These are checked by the individual tool's checkPermissions method
  // and integrated via the permission engine's evaluation chain

  // Step 7: Check allow rules
  const allowMatch = matchCommandAgainstRules(command, allowRules as any, true)
  if (allowMatch.matched) {
    return {
      behavior: 'allow',
      updatedInput: { command },
    }
  }

  // Step 8: Generate suggestions for the permission prompt
  const prefix = getSimpleCommandPrefix(command)
  const suggestions: string[] = []
  if (prefix && !BARE_SHELL_PREFIXES.has(prefix.split(' ')[0]!)) {
    suggestions.push(`Bash(${prefix}:*)`)
  }

  return {
    behavior: 'passthrough',
    message: suggestions.length > 0
      ? `Allow this command? Suggested rule: ${suggestions[0]}`
      : 'Kite wants to run a bash command.',
  }
}

/**
 * Check permission for a bash command, handling compound commands.
 *
 * For compound commands (&&, ||, ;), each subcommand is checked individually.
 */
export function bashToolHasPermission(
  command: string,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const subcommands = splitCommand(command)

  if (subcommands.length <= 1) {
    return bashToolCheckPermission(command, toolPermissionContext)
  }

  // For compound commands, check each subcommand
  for (const sub of subcommands) {
    const trimmed = sub.trim()
    if (!trimmed) continue

    const result = bashToolCheckPermission(trimmed, toolPermissionContext)
    if (result.behavior === 'deny') return result
    if (result.behavior === 'ask') return result
  }

  // All subcommands passed
  return {
    behavior: 'allow',
    updatedInput: { command },
  }
}
