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
import { useCallback, useSyncExternalStore } from 'react';
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60)
        return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60)
        return `${minutes}m ${seconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}
export function useElapsedTime(startTime, isRunning, ms = 1000, pausedMs = 0, endTime) {
    const get = () => formatDuration(Math.max(0, (endTime ?? Date.now()) - startTime - pausedMs));
    const subscribe = useCallback((notify) => {
        if (!isRunning)
            return () => { };
        const interval = setInterval(notify, ms);
        return () => clearInterval(interval);
    }, [isRunning, ms]);
    return useSyncExternalStore(subscribe, get, get);
}
export { formatDuration };
//# sourceMappingURL=useElapsedTime.js.map