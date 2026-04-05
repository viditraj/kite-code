/**
 * useInterval hook — setInterval with React lifecycle.
 *
 * Matches Claude Code's useInterval/useAnimationFrame pattern.
 * Runs callback at specified interval, pauses when null.
 */
import { useEffect, useRef } from 'react';
/**
 * Run a callback at a fixed interval.
 * Pass null for delay to pause.
 */
export function useInterval(callback, delayMs) {
    const savedCallback = useRef(callback);
    // Update ref on each render so we always call the latest callback
    savedCallback.current = callback;
    useEffect(() => {
        if (delayMs === null)
            return;
        const id = setInterval(() => savedCallback.current(), delayMs);
        return () => clearInterval(id);
    }, [delayMs]);
}
//# sourceMappingURL=useInterval.js.map