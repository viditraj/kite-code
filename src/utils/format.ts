/**
 * Format utilities — relative time, file sizes, and display helpers.
 *
 * Matches Claude Code's utils/format.ts patterns.
 */

import { execSync } from 'child_process'

// ============================================================================
// Relative Time (matches CC's formatRelativeTime)
// ============================================================================

const TIME_INTERVALS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 31_536_000 },
  { unit: 'month', seconds: 2_592_000 },
  { unit: 'week', seconds: 604_800 },
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
]

export type RelativeTimeStyle = 'narrow' | 'long'

/**
 * Format a date as relative time (e.g., "2h ago", "3 days ago").
 * Uses Intl.RelativeTimeFormat for localization.
 */
export function formatRelativeTime(
  date: Date,
  options: { style?: RelativeTimeStyle; now?: Date } = {},
): string {
  const { style = 'narrow', now = new Date() } = options
  const elapsed = (date.getTime() - now.getTime()) / 1000

  for (const { unit, seconds } of TIME_INTERVALS) {
    if (Math.abs(elapsed) >= seconds || unit === 'second') {
      const value = Math.round(elapsed / seconds)
      try {
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style })
        return rtf.format(value, unit)
      } catch {
        // Fallback without Intl
        const abs = Math.abs(value)
        const suffix = value < 0 ? ' ago' : ''
        return `${abs}${unit.charAt(0)}${suffix}`
      }
    }
  }
  return 'just now'
}

/**
 * Format a date as "X ago" (always past tense).
 */
export function formatRelativeTimeAgo(
  date: Date,
  options: { style?: RelativeTimeStyle; now?: Date } = {},
): string {
  const { now = new Date() } = options
  // Ensure we always show past tense
  const adjustedDate = date.getTime() > now.getTime() ? now : date
  return formatRelativeTime(adjustedDate, options)
}

// ============================================================================
// File Size Formatting
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ============================================================================
// Token Formatting
// ============================================================================

export function formatTokenCount(n: number): string {
  if (n === 0) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k'
  return (n / 1_000_000).toFixed(2) + 'M'
}

// ============================================================================
// Context Window Detection
// ============================================================================

/**
 * Estimate the context window size for a model based on its name.
 * Returns token count.
 */
export function getContextWindowForModel(model: string): number {
  const m = model.toLowerCase()
  if (m.includes('gemma')) return 1_000_000
  if (m.includes('claude') && m.includes('opus')) return 200_000
  if (m.includes('claude')) return 200_000
  if (m.includes('gpt-4o')) return 128_000
  if (m.includes('gpt-4')) return 128_000
  if (m.includes('o1') || m.includes('o3')) return 200_000
  if (m.includes('llama')) return 128_000
  if (m.includes('deepseek')) return 64_000
  if (m.includes('mistral')) return 128_000
  if (m.includes('mixtral')) return 32_000
  return 128_000
}

// ============================================================================
// Git Branch
// ============================================================================

let cachedBranch: string | null = null
let branchCacheTime = 0
const BRANCH_CACHE_TTL = 10_000 // 10 seconds

/**
 * Get the current git branch name. Cached for 10 seconds.
 * Returns null if not in a git repo.
 */
export function getGitBranch(): string | null {
  const now = Date.now()
  if (cachedBranch !== null && now - branchCacheTime < BRANCH_CACHE_TTL) {
    return cachedBranch
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: 'pipe',
    }).trim()
    cachedBranch = branch || null
    branchCacheTime = now
    return cachedBranch
  } catch {
    cachedBranch = null
    branchCacheTime = now
    return null
  }
}
