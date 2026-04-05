/**
 * Multi-provider cost tracking.
 *
 * Implements the same patterns as Claude Code's cost-tracker.ts:
 * - Track token usage per model
 * - Calculate USD cost from token counts and model pricing
 * - Session cost persistence and restoration
 * - Cost summary formatting
 */
import type { TokenUsage } from './providers/types.js';
export interface ModelUsageEntry {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    requestCount: number;
    totalCostUSD: number;
}
export interface CostState {
    totalCostUSD: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    totalRequestCount: number;
    totalDurationMs: number;
    totalToolDurationMs: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    modelUsage: Map<string, ModelUsageEntry>;
    startTime: number;
}
export interface StoredCostState {
    totalCostUSD: number;
    totalDurationMs: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    modelUsage: Record<string, ModelUsageEntry>;
}
/**
 * Record a completed API request's token usage.
 */
export declare function recordUsage(model: string, usage: TokenUsage, durationMs: number, costUSD: number): void;
/**
 * Record tool execution duration.
 */
export declare function recordToolDuration(durationMs: number): void;
/**
 * Record lines changed (for session stats).
 */
export declare function addToTotalLinesChanged(added: number, removed: number): void;
export declare function getTotalCost(): number;
export declare function getTotalDuration(): number;
export declare function getTotalAPIDuration(): number;
export declare function getTotalToolDuration(): number;
export declare function getTotalInputTokens(): number;
export declare function getTotalOutputTokens(): number;
export declare function getTotalCacheReadInputTokens(): number;
export declare function getTotalCacheCreationInputTokens(): number;
export declare function getTotalLinesAdded(): number;
export declare function getTotalLinesRemoved(): number;
export declare function getModelUsage(): Map<string, ModelUsageEntry>;
export declare function getUsageForModel(model: string): ModelUsageEntry | undefined;
export declare function formatCost(usd: number): string;
export declare function formatNumber(n: number): string;
export declare function formatDuration(ms: number): string;
/**
 * Format a complete cost summary for display.
 */
export declare function formatCostSummary(): string;
/**
 * Save current session costs to a serializable format.
 */
export declare function saveCurrentSessionCosts(): StoredCostState;
/**
 * Restore session costs from a stored state.
 */
export declare function restoreSessionCosts(stored: StoredCostState): void;
/**
 * Reset all cost tracking state.
 */
export declare function resetCostState(): void;
/**
 * Set cost state for session restore (used when resuming).
 */
export declare function setCostStateForRestore(stored: StoredCostState): void;
//# sourceMappingURL=cost-tracker.d.ts.map