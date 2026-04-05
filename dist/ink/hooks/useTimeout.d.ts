/**
 * useTimeout — setTimeout with auto-cleanup on unmount.
 *
 * Ported from Claude Code's useTimeout.ts.
 * Returns true when the delay has elapsed. Resets on resetTrigger changes.
 *
 * @param delay - Timeout duration in ms
 * @param resetTrigger - Optional value; changing it resets the timer
 * @returns true when the timeout has elapsed
 */
export declare function useTimeout(delay: number, resetTrigger?: number): boolean;
//# sourceMappingURL=useTimeout.d.ts.map