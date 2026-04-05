/**
 * useElapsedTime — formatted elapsed time with interval-based updates.
 *
 * Ported from Claude Code's useElapsedTime.ts.
 * Uses useSyncExternalStore with setInterval for efficient re-renders.
 *
 * @param startTime - Unix timestamp in ms
 * @param isRunning - Whether to actively update the timer
 * @param ms - Update interval in ms (default 1000)
 * @param pausedMs - Total paused duration to subtract
 * @param endTime - If set, freezes the duration at this timestamp
 * @returns Formatted duration string (e.g., "1m 23s")
 */
declare function formatDuration(ms: number): string;
export declare function useElapsedTime(startTime: number, isRunning: boolean, ms?: number, pausedMs?: number, endTime?: number): string;
export { formatDuration };
//# sourceMappingURL=useElapsedTime.d.ts.map