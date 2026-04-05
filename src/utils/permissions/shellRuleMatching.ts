/**
 * Shell permission rule matching.
 *
 * Implements the same logic as Claude Code's shellRuleMatching.ts:
 * - Wildcard pattern matching with * (dotAll for newlines)
 * - Legacy :* prefix syntax
 * - Escaped star (\*) for literal asterisks
 * - Optional trailing space+wildcard for single-wildcard patterns
 */

// Sentinel placeholders for wildcard pattern escaping
const ESCAPED_STAR = '\x00ESCAPED_STAR\x00'
const ESCAPED_BACKSLASH = '\x00ESCAPED_BACKSLASH\x00'
const ESCAPED_STAR_RE = /\x00ESCAPED_STAR\x00/g
const ESCAPED_BACKSLASH_RE = /\x00ESCAPED_BACKSLASH\x00/g

export type ShellPermissionRule =
  | { type: 'exact'; command: string }
  | { type: 'prefix'; prefix: string }
  | { type: 'wildcard'; pattern: string }

/**
 * Extract prefix from legacy :* syntax (e.g., "npm:*" → "npm").
 */
export function permissionRuleExtractPrefix(permissionRule: string): string | null {
  const match = permissionRule.match(/^(.+):\*$/)
  return match?.[1] ?? null
}

/**
 * Check if a pattern contains unescaped wildcards (not legacy :* syntax).
 */
export function hasWildcards(pattern: string): boolean {
  if (pattern.endsWith(':*')) return false
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*') {
      let backslashCount = 0
      let j = i - 1
      while (j >= 0 && pattern[j] === '\\') {
        backslashCount++
        j--
      }
      if (backslashCount % 2 === 0) return true
    }
  }
  return false
}

/**
 * Match a command against a wildcard pattern.
 *
 * Wildcards (*) match any sequence of characters including newlines.
 * Use \* for literal asterisk, \\ for literal backslash.
 *
 * When pattern ends with ' *' and it's the only wildcard,
 * the trailing space+args are optional (so 'git *' matches bare 'git').
 */
export function matchWildcardPattern(
  pattern: string,
  command: string,
  caseInsensitive = false,
): boolean {
  const trimmedPattern = pattern.trim()

  // Process escape sequences: \* and \\
  let processed = ''
  let i = 0
  while (i < trimmedPattern.length) {
    const char = trimmedPattern[i]!
    if (char === '\\' && i + 1 < trimmedPattern.length) {
      const nextChar = trimmedPattern[i + 1]
      if (nextChar === '*') {
        processed += ESCAPED_STAR
        i += 2
        continue
      } else if (nextChar === '\\') {
        processed += ESCAPED_BACKSLASH
        i += 2
        continue
      }
    }
    processed += char
    i++
  }

  // Escape regex special characters except *
  const escaped = processed.replace(/[.+?^${}()|[\]\\'"]/g, '\\$&')

  // Convert unescaped * to .* for wildcard matching
  const withWildcards = escaped.replace(/\*/g, '.*')

  // Convert placeholders back to escaped regex literals
  let regexPattern = withWildcards
    .replace(ESCAPED_STAR_RE, '\\*')
    .replace(ESCAPED_BACKSLASH_RE, '\\\\')

  // When pattern ends with ' .*' (from ' *') and it's the only wildcard,
  // make trailing space+args optional so 'git *' matches bare 'git'
  const unescapedStarCount = (processed.match(/\*/g) || []).length
  if (regexPattern.endsWith(' .*') && unescapedStarCount === 1) {
    regexPattern = regexPattern.slice(0, -3) + '( .*)?'
  }

  // dotAll flag (s) makes . match newlines
  const flags = 's' + (caseInsensitive ? 'i' : '')
  const regex = new RegExp(`^${regexPattern}$`, flags)
  return regex.test(command)
}

/**
 * Parse a permission rule string into a structured rule object.
 */
export function parsePermissionRule(permissionRule: string): ShellPermissionRule {
  const prefix = permissionRuleExtractPrefix(permissionRule)
  if (prefix !== null) {
    return { type: 'prefix', prefix }
  }
  if (hasWildcards(permissionRule)) {
    return { type: 'wildcard', pattern: permissionRule }
  }
  return { type: 'exact', command: permissionRule }
}
