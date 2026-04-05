/**
 * Token budget tracking and continuation decisions.
 *
 * Implements the same logic as Claude Code's query/tokenBudget.ts:
 * - Track cumulative output tokens per continuation
 * - Decide when to continue vs. stop
 * - Diminishing returns detection
 * - 90% budget threshold
 */
export interface BudgetTracker {
    continuationCount: number;
    lastDeltaTokens: number;
    cumulativeOutputTokens: number;
    startedAt: number;
}
export declare function createBudgetTracker(): BudgetTracker;
export type TokenBudgetDecision = {
    action: 'continue';
    reason: string;
} | {
    action: 'stop';
    reason: string;
};
/**
 * Check the token budget and decide whether to continue.
 *
 * Criteria for stopping:
 * 1. Budget exhausted (>= 90% used)
 * 2. Max continuations reached
 * 3. Diminishing returns (output shrinking dramatically)
 * 4. Turn was unproductive (< MIN_PRODUCTIVE_TOKENS output)
 */
export declare function checkTokenBudget(tracker: BudgetTracker, totalBudget: number, turnOutputTokens: number): TokenBudgetDecision;
/**
 * Estimate total tokens in a message array.
 * Rough estimate: 4 chars per token for text, plus overhead.
 */
export declare function estimateTokenCount(messages: Array<{
    content: string | unknown[];
}>): number;
//# sourceMappingURL=tokenBudget.d.ts.map