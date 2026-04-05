/**
 * Denial tracking for permission decisions.
 *
 * Implements the same logic as Claude Code's denialTracking.ts:
 * - Track consecutive and total denials
 * - Determine when to fall back to prompting
 * - Immutable state updates (return new objects)
 */
export const DENIAL_LIMITS = {
    maxConsecutive: 3,
    maxTotal: 20,
};
export function createDenialTrackingState() {
    return { consecutiveDenials: 0, totalDenials: 0 };
}
export function recordDenial(state) {
    return {
        ...state,
        consecutiveDenials: state.consecutiveDenials + 1,
        totalDenials: state.totalDenials + 1,
    };
}
export function recordSuccess(state) {
    if (state.consecutiveDenials === 0)
        return state;
    return { ...state, consecutiveDenials: 0 };
}
export function shouldFallbackToPrompting(state) {
    return (state.consecutiveDenials >= DENIAL_LIMITS.maxConsecutive ||
        state.totalDenials >= DENIAL_LIMITS.maxTotal);
}
//# sourceMappingURL=denialTracking.js.map