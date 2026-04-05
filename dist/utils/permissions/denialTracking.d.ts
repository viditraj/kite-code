/**
 * Denial tracking for permission decisions.
 *
 * Implements the same logic as Claude Code's denialTracking.ts:
 * - Track consecutive and total denials
 * - Determine when to fall back to prompting
 * - Immutable state updates (return new objects)
 */
export interface DenialTrackingState {
    consecutiveDenials: number;
    totalDenials: number;
}
export declare const DENIAL_LIMITS: {
    readonly maxConsecutive: 3;
    readonly maxTotal: 20;
};
export declare function createDenialTrackingState(): DenialTrackingState;
export declare function recordDenial(state: DenialTrackingState): DenialTrackingState;
export declare function recordSuccess(state: DenialTrackingState): DenialTrackingState;
export declare function shouldFallbackToPrompting(state: DenialTrackingState): boolean;
//# sourceMappingURL=denialTracking.d.ts.map