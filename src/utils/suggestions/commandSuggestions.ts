/**
 * Command autocomplete — generate suggestions when user types '/'.
 *
 * Adapted from Claude Code's commandSuggestions.ts for Kite.
 * Provides fuzzy matching of command names, aliases, and descriptions.
 */

import { getCommands } from '../../commands.js'
import type { Command } from '../../types/command.js'

// ============================================================================
// Types
// ============================================================================

export interface CommandSuggestion {
  /** Command name (e.g., 'help', 'model') */
  name: string
  /** Display text with / prefix (e.g., '/help') */
  displayText: string
  /** Command description */
  description: string
  /** Optional argument hint */
  argumentHint?: string
  /** Aliases for this command */
  aliases?: string[]
  /** Match score (0-1, higher is better) */
  score: number
  /** Tag indicating source: 'skill', 'plugin', or undefined for built-in */
  tag?: string
}

export type SuggestionType = 'command' | 'file' | 'none'

// ============================================================================
// Scoring
// ============================================================================

/**
 * Simple fuzzy match: returns a score between 0 and 1.
 * Exact prefix match gets highest score; contains gets lower score.
 */
function fuzzyScore(query: string, target: string): number {
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()

  // Exact match
  if (lowerTarget === lowerQuery) return 1.0

  // Prefix match
  if (lowerTarget.startsWith(lowerQuery)) {
    return 0.9 - (lowerTarget.length - lowerQuery.length) * 0.001
  }

  // Contains match
  if (lowerTarget.includes(lowerQuery)) {
    const position = lowerTarget.indexOf(lowerQuery)
    return 0.6 - position * 0.01
  }

  // Word boundary match (e.g., 'os' matches 'output-style')
  const words = lowerTarget.split(/[-_\s]/)
  for (const word of words) {
    if (word.startsWith(lowerQuery)) {
      return 0.5
    }
  }

  // Character subsequence match
  let qi = 0
  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) {
      qi++
    }
  }
  if (qi === lowerQuery.length) {
    return 0.3 * (lowerQuery.length / lowerTarget.length)
  }

  return 0
}

// ============================================================================
// Suggestion generation
// ============================================================================

/**
 * Generate command suggestions for a given query string.
 *
 * @param query - The text after '/' (may be empty for all commands)
 * @param maxResults - Maximum number of suggestions to return (default 15)
 * @returns Array of CommandSuggestion sorted by score descending
 */
export function generateCommandSuggestions(
  query: string,
  maxResults: number = 15,
): CommandSuggestion[] {
  const commands = getCommands().filter(c => !c.isHidden && (c.isEnabled?.() ?? true))

  if (query.length === 0) {
    // No query — return all commands sorted alphabetically
    return commands
      .map(cmdToSuggestion)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, maxResults)
  }

  // Score each command
  const scored: CommandSuggestion[] = []

  for (const cmd of commands) {
    // Score against name (highest weight)
    let bestScore = fuzzyScore(query, cmd.name) * 3.0

    // Score against aliases
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        const aliasScore = fuzzyScore(query, alias) * 2.0
        if (aliasScore > bestScore) bestScore = aliasScore
      }
    }

    // Score against description (low weight)
    const descScore = fuzzyScore(query, cmd.description) * 0.5
    if (descScore > bestScore) bestScore = descScore

    // Normalize back to 0-1 range (max weight was 3.0)
    const normalizedScore = Math.min(bestScore / 3.0, 1.0)

    if (normalizedScore > 0.01) {
      scored.push({
        ...cmdToSuggestion(cmd),
        score: normalizedScore,
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/**
 * Find the best matching command for ghost text (inline completion).
 *
 * @param query - The text after '/'
 * @returns The best-matching command name suffix, or null
 */
export function getBestCommandMatch(query: string): string | null {
  if (query.length === 0) return null

  const suggestions = generateCommandSuggestions(query, 1)
  if (suggestions.length === 0) return null

  const best = suggestions[0]!
  if (best.score < 0.5) return null

  // Return the suffix that completes the command
  const lowerName = best.name.toLowerCase()
  const lowerQuery = query.toLowerCase()
  if (lowerName.startsWith(lowerQuery)) {
    return best.name.slice(query.length)
  }

  return null
}

/**
 * Detect a slash command in the input text.
 * Returns the command prefix (without /) if found at the start of the input.
 */
export function findSlashCommandPrefix(input: string): string | null {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith('/')) return null

  // Extract the command portion (everything up to the first space or end)
  const spaceIdx = trimmed.indexOf(' ', 1)
  if (spaceIdx === -1) {
    return trimmed.slice(1) // Everything after /
  }
  return trimmed.slice(1, spaceIdx)
}

// ============================================================================
// Helpers
// ============================================================================

function cmdToSuggestion(cmd: Command): CommandSuggestion {
  const tag = cmd.loadedFrom === 'skills' ? 'skill'
    : cmd.loadedFrom === 'plugin' ? 'plugin'
    : undefined
  return {
    name: cmd.name,
    displayText: `/${cmd.name}`,
    description: cmd.description,
    argumentHint: cmd.argumentHint,
    aliases: cmd.aliases,
    score: 0,
    tag,
  }
}
