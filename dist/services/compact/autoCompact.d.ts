/**
 * Auto-compaction: trigger compaction when approaching context limits.
 *
 * Implements the same pattern as Claude Code's autoCompact.ts:
 * - Estimate total context size
 * - Compare against model's context window
 * - Trigger compaction proactively (before hitting the limit)
 * - Track compaction state across turns
 */
import type { LLMProvider, UnifiedMessage } from '../../providers/types.js';
export declare function getContextWindow(model: string): number;
/**
 * Calculate token warning state for the current context.
 */
export declare function calculateTokenWarningState(estimatedTokens: number, model: string): {
    isAtBlockingLimit: boolean;
    isNearLimit: boolean;
    usedFraction: number;
};
export interface AutoCompactTrackingState {
    compacted: boolean;
    turnCounter: number;
    consecutiveFailures: number;
}
export declare function createAutoCompactTracking(): AutoCompactTrackingState;
export interface AutoCompactResult {
    messages: UnifiedMessage[];
    compacted: boolean;
    tokensFreed: number;
    tracking: AutoCompactTrackingState;
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
export declare function autoCompact(messages: UnifiedMessage[], model: string, provider: LLMProvider, tracking?: AutoCompactTrackingState): Promise<AutoCompactResult>;
//# sourceMappingURL=autoCompact.d.ts.map