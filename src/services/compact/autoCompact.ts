/**
 * Auto-compaction: trigger compaction when approaching context limits.
 *
 * Implements the same pattern as Claude Code's autoCompact.ts:
 * - Estimate total context size
 * - Compare against model's context window
 * - Trigger compaction proactively (before hitting the limit)
 * - Track compaction state across turns
 */

import type { LLMProvider, UnifiedMessage } from '../../providers/types.js'
import { estimateTokenCount } from '../../query/tokenBudget.js'
import { compact } from './compact.js'
import { microCompact } from './microCompact.js'

// ============================================================================
// Constants
// ============================================================================

/** Model context window sizes (approximate) */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic
  'claude-sonnet-4-20250514': 200000,
  'claude-opus-4-20250514': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-haiku-20240307': 200000,
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  // Others
  'deepseek-chat': 128000,
  'mistral-large-latest': 128000,
}

/** Default context window if model is unknown */
const DEFAULT_CONTEXT_WINDOW = 128000

/** Compact when reaching this fraction of the context window */
const COMPACT_THRESHOLD = 0.75

/** Blocking limit — refuse to send when above this fraction */
const BLOCKING_THRESHOLD = 0.95

// ============================================================================
// Context window helpers
// ============================================================================

export function getContextWindow(model: string): number {
  // Check exact match
  if (model in MODEL_CONTEXT_WINDOWS) return MODEL_CONTEXT_WINDOWS[model]!

  // Check prefix match (e.g., "claude-" models)
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(key.split('-').slice(0, 2).join('-'))) return value
  }

  return DEFAULT_CONTEXT_WINDOW
}

/**
 * Calculate token warning state for the current context.
 */
export function calculateTokenWarningState(
  estimatedTokens: number,
  model: string,
): { isAtBlockingLimit: boolean; isNearLimit: boolean; usedFraction: number } {
  const contextWindow = getContextWindow(model)
  const usedFraction = estimatedTokens / contextWindow

  return {
    isAtBlockingLimit: usedFraction >= BLOCKING_THRESHOLD,
    isNearLimit: usedFraction >= COMPACT_THRESHOLD,
    usedFraction,
  }
}

// ============================================================================
// Auto-compact tracking
// ============================================================================

export interface AutoCompactTrackingState {
  compacted: boolean
  turnCounter: number
  consecutiveFailures: number
}

export function createAutoCompactTracking(): AutoCompactTrackingState {
  return {
    compacted: false,
    turnCounter: 0,
    consecutiveFailures: 0,
  }
}

// ============================================================================
// autoCompact — entry point
// ============================================================================

export interface AutoCompactResult {
  messages: UnifiedMessage[]
  compacted: boolean
  tokensFreed: number
  tracking: AutoCompactTrackingState
}

/**
 * Auto-compact messages if approaching context limits.
 *
 * Steps:
 * 1. Estimate current token count
 * 2. If below threshold, return unchanged
 * 3. Apply microcompact first (free, no LLM)
 * 4. If still above threshold, run full LLM compaction
 */
export async function autoCompact(
  messages: UnifiedMessage[],
  model: string,
  provider: LLMProvider,
  tracking?: AutoCompactTrackingState,
): Promise<AutoCompactResult> {
  const state = tracking ?? createAutoCompactTracking()
  const contextWindow = getContextWindow(model)
  const threshold = contextWindow * COMPACT_THRESHOLD

  // Step 1: Estimate tokens
  const estimatedTokens = estimateTokenCount(messages)
  if (estimatedTokens < threshold) {
    return {
      messages,
      compacted: false,
      tokensFreed: 0,
      tracking: state,
    }
  }

  // Step 2: Try microcompact first
  const microCompacted = microCompact(messages)
  const postMicroTokens = estimateTokenCount(microCompacted)

  if (postMicroTokens < threshold) {
    const tokensFreed = estimatedTokens - postMicroTokens
    return {
      messages: microCompacted,
      compacted: true,
      tokensFreed,
      tracking: { ...state, compacted: true, turnCounter: 0 },
    }
  }

  // Step 3: Full LLM compaction
  try {
    const result = await compact(microCompacted, provider, model)
    if (result.compacted) {
      return {
        messages: result.messages,
        compacted: true,
        tokensFreed: result.tokensFreed,
        tracking: { ...state, compacted: true, turnCounter: 0, consecutiveFailures: 0 },
      }
    }
  } catch {
    // Compaction failed — continue with microcompacted messages
    return {
      messages: microCompacted,
      compacted: postMicroTokens < estimatedTokens,
      tokensFreed: estimatedTokens - postMicroTokens,
      tracking: { ...state, consecutiveFailures: state.consecutiveFailures + 1 },
    }
  }

  // Compaction didn't help
  return {
    messages: microCompacted,
    compacted: postMicroTokens < estimatedTokens,
    tokensFreed: estimatedTokens - postMicroTokens,
    tracking: state,
  }
}
