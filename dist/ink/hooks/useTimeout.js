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
import { useEffect, useState } from 'react';
export function useTimeout(delay, resetTrigger) {
    const [isElapsed, setIsElapsed] = useState(false);
    useEffect(() => {
        setIsElapsed(false);
        const timer = setTimeout(setIsElapsed, delay, true);
        return () => clearTimeout(timer);
    }, [delay, resetTrigger]);
    return isElapsed;
}
//# sourceMappingURL=useTimeout.js.map