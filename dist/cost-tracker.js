/**
 * Multi-provider cost tracking.
 *
 * Implements the same patterns as Claude Code's cost-tracker.ts:
 * - Track token usage per model
 * - Calculate USD cost from token counts and model pricing
 * - Session cost persistence and restoration
 * - Cost summary formatting
 */
// ============================================================================
// Global state
// ============================================================================
let costState = createEmptyCostState();
function createEmptyCostState() {
    return {
        totalCostUSD: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalRequestCount: 0,
        totalDurationMs: 0,
        totalToolDurationMs: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        modelUsage: new Map(),
        startTime: Date.now(),
    };
}
// ============================================================================
// Cost tracking
// ============================================================================
/**
 * Record a completed API request's token usage.
 */
export function recordUsage(model, usage, durationMs, costUSD) {
    costState.totalInputTokens += usage.inputTokens;
    costState.totalOutputTokens += usage.outputTokens;
    costState.totalCacheReadTokens += usage.cacheReadInputTokens;
    costState.totalCacheWriteTokens += usage.cacheCreationInputTokens;
    costState.totalRequestCount++;
    costState.totalDurationMs += durationMs;
    costState.totalCostUSD += costUSD;
    const existing = costState.modelUsage.get(model);
    if (existing) {
        existing.inputTokens += usage.inputTokens;
        existing.outputTokens += usage.outputTokens;
        existing.cacheReadTokens += usage.cacheReadInputTokens;
        existing.cacheWriteTokens += usage.cacheCreationInputTokens;
        existing.requestCount++;
        existing.totalCostUSD += costUSD;
    }
    else {
        costState.modelUsage.set(model, {
            model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadInputTokens,
            cacheWriteTokens: usage.cacheCreationInputTokens,
            requestCount: 1,
            totalCostUSD: costUSD,
        });
    }
}
/**
 * Record tool execution duration.
 */
export function recordToolDuration(durationMs) {
    costState.totalToolDurationMs += durationMs;
}
/**
 * Record lines changed (for session stats).
 */
export function addToTotalLinesChanged(added, removed) {
    costState.totalLinesAdded += added;
    costState.totalLinesRemoved += removed;
}
// ============================================================================
// Getters
// ============================================================================
export function getTotalCost() {
    return costState.totalCostUSD;
}
export function getTotalDuration() {
    return Date.now() - costState.startTime;
}
export function getTotalAPIDuration() {
    return costState.totalDurationMs;
}
export function getTotalToolDuration() {
    return costState.totalToolDurationMs;
}
export function getTotalInputTokens() {
    return costState.totalInputTokens;
}
export function getTotalOutputTokens() {
    return costState.totalOutputTokens;
}
export function getTotalCacheReadInputTokens() {
    return costState.totalCacheReadTokens;
}
export function getTotalCacheCreationInputTokens() {
    return costState.totalCacheWriteTokens;
}
export function getTotalLinesAdded() {
    return costState.totalLinesAdded;
}
export function getTotalLinesRemoved() {
    return costState.totalLinesRemoved;
}
export function getModelUsage() {
    return new Map(costState.modelUsage);
}
export function getUsageForModel(model) {
    return costState.modelUsage.get(model);
}
// ============================================================================
// Formatting
// ============================================================================
export function formatCost(usd) {
    if (usd < 0.005)
        return '$0.00';
    return `$${usd.toFixed(2)}`;
}
export function formatNumber(n) {
    return n.toLocaleString();
}
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60)
        return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60)
        return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}
/**
 * Format a complete cost summary for display.
 */
export function formatCostSummary() {
    const lines = [
        `Cost:     ${formatCost(costState.totalCostUSD)}`,
        `Duration: ${formatDuration(getTotalDuration())}`,
        `Tokens:   ${formatNumber(costState.totalInputTokens)} in / ${formatNumber(costState.totalOutputTokens)} out`,
    ];
    if (costState.totalCacheReadTokens > 0 || costState.totalCacheWriteTokens > 0) {
        lines.push(`Cache:    ${formatNumber(costState.totalCacheReadTokens)} read / ${formatNumber(costState.totalCacheWriteTokens)} write`);
    }
    if (costState.totalLinesAdded > 0 || costState.totalLinesRemoved > 0) {
        lines.push(`Lines:    +${formatNumber(costState.totalLinesAdded)} / -${formatNumber(costState.totalLinesRemoved)}`);
    }
    lines.push(`Requests: ${formatNumber(costState.totalRequestCount)}`);
    // Per-model breakdown
    if (costState.modelUsage.size > 1) {
        lines.push('');
        lines.push('Per model:');
        for (const [model, entry] of costState.modelUsage) {
            lines.push(`  ${model}: ${formatCost(entry.totalCostUSD)} (${formatNumber(entry.requestCount)} requests, ${formatNumber(entry.inputTokens + entry.outputTokens)} tokens)`);
        }
    }
    return lines.join('\n');
}
// ============================================================================
// Persistence
// ============================================================================
/**
 * Save current session costs to a serializable format.
 */
export function saveCurrentSessionCosts() {
    const modelUsage = {};
    for (const [model, entry] of costState.modelUsage) {
        modelUsage[model] = { ...entry };
    }
    return {
        totalCostUSD: costState.totalCostUSD,
        totalDurationMs: costState.totalDurationMs,
        totalLinesAdded: costState.totalLinesAdded,
        totalLinesRemoved: costState.totalLinesRemoved,
        modelUsage,
    };
}
/**
 * Restore session costs from a stored state.
 */
export function restoreSessionCosts(stored) {
    costState.totalCostUSD = stored.totalCostUSD;
    costState.totalDurationMs = stored.totalDurationMs;
    costState.totalLinesAdded = stored.totalLinesAdded;
    costState.totalLinesRemoved = stored.totalLinesRemoved;
    for (const [model, entry] of Object.entries(stored.modelUsage)) {
        costState.modelUsage.set(model, { ...entry });
        costState.totalInputTokens += entry.inputTokens;
        costState.totalOutputTokens += entry.outputTokens;
        costState.totalCacheReadTokens += entry.cacheReadTokens;
        costState.totalCacheWriteTokens += entry.cacheWriteTokens;
        costState.totalRequestCount += entry.requestCount;
    }
}
/**
 * Reset all cost tracking state.
 */
export function resetCostState() {
    costState = createEmptyCostState();
}
/**
 * Set cost state for session restore (used when resuming).
 */
export function setCostStateForRestore(stored) {
    resetCostState();
    restoreSessionCosts(stored);
}
//# sourceMappingURL=cost-tracker.js.map