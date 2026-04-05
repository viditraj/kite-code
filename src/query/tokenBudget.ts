/**
 * Token budget tracking and continuation decisions.
 *
 * Implements the same logic as Claude Code's query/tokenBudget.ts:
 * - Track cumulative output tokens per continuation
 * - Decide when to continue vs. stop
 * - Diminishing returns detection
 * - 90% budget threshold
 */

import type { TokenUsage } from '../providers/types.js'

// ============================================================================
// Constants
// ============================================================================

/** Maximum fraction of budget before stopping (90%) */
const BUDGET_THRESHOLD = 0.9

/** Minimum output tokens to consider a turn productive */
const MIN_PRODUCTIVE_TOKENS = 50

/** Max continuation attempts before forcing stop */
const MAX_CONTINUATIONS = 10

/** Detect diminishing returns: if current delta < previous * this factor */
const DIMINISHING_RETURNS_FACTOR = 0.25

// ============================================================================
// Budget Tracker State
// ============================================================================

export interface BudgetTracker {
  continuationCount: number
  lastDeltaTokens: number
  cumulativeOutputTokens: number
  startedAt: number
}

export function createBudgetTracker(): BudgetTracker {
  return {
    continuationCount: 0,
    lastDeltaTokens: 0,
    cumulativeOutputTokens: 0,
    startedAt: Date.now(),
  }
}

// ============================================================================
// Budget Decision
// ============================================================================

export type TokenBudgetDecision =
  | { action: 'continue'; reason: string }
  | { action: 'stop'; reason: string }

/**
 * Check the token budget and decide whether to continue.
 *
 * Criteria for stopping:
 * 1. Budget exhausted (>= 90% used)
 * 2. Max continuations reached
 * 3. Diminishing returns (output shrinking dramatically)
 * 4. Turn was unproductive (< MIN_PRODUCTIVE_TOKENS output)
 */
export function checkTokenBudget(
  tracker: BudgetTracker,
  totalBudget: number,
  turnOutputTokens: number,
): TokenBudgetDecision {
  // Update tracker
  const updatedTracker: BudgetTracker = {
    ...tracker,
    continuationCount: tracker.continuationCount + 1,
    lastDeltaTokens: turnOutputTokens,
    cumulativeOutputTokens: tracker.cumulativeOutputTokens + turnOutputTokens,
  }

  // Copy back
  Object.assign(tracker, updatedTracker)

  // Check max continuations
  if (tracker.continuationCount >= MAX_CONTINUATIONS) {
    return { action: 'stop', reason: `max continuations reached (${MAX_CONTINUATIONS})` }
  }

  // Check budget threshold
  const usedFraction = tracker.cumulativeOutputTokens / totalBudget
  if (usedFraction >= BUDGET_THRESHOLD) {
    return {
      action: 'stop',
      reason: `budget threshold reached (${(usedFraction * 100).toFixed(0)}% of ${totalBudget})`,
    }
  }

  // Check for unproductive turn
  if (turnOutputTokens < MIN_PRODUCTIVE_TOKENS && tracker.continuationCount > 1) {
    return {
      action: 'stop',
      reason: `unproductive turn (${turnOutputTokens} tokens < ${MIN_PRODUCTIVE_TOKENS} minimum)`,
    }
  }

  // Check diminishing returns
  if (
    tracker.lastDeltaTokens > 0 &&
    tracker.continuationCount > 2 &&
    turnOutputTokens < tracker.lastDeltaTokens * DIMINISHING_RETURNS_FACTOR
  ) {
    return {
      action: 'stop',
      reason: `diminishing returns (${turnOutputTokens} << ${tracker.lastDeltaTokens} previous)`,
    }
  }

  return {
    action: 'continue',
    reason: `${(usedFraction * 100).toFixed(0)}% used, continuation #${tracker.continuationCount}`,
  }
}

/**
 * Estimate total tokens in a message array.
 * Rough estimate: 4 chars per token for text, plus overhead.
 */
export function estimateTokenCount(messages: Array<{ content: string | unknown[] }>): number {
  let chars = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === 'object' && block !== null) {
          const b = block as Record<string, unknown>
          if (b.type === 'text' && typeof b.text === 'string') chars += b.text.length
          else if (b.type === 'tool_result' && typeof b.content === 'string') chars += b.content.length
          else if (b.type === 'tool_use') chars += JSON.stringify(b.input ?? {}).length
          else chars += 50 // overhead for structured blocks
        }
      }
    }
  }
  // ~4 chars per token + message overhead
  return Math.ceil(chars / 4) + messages.length * 4
}
