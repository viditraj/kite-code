/**
 * useMinDisplayTime — throttle a value so each distinct value stays visible
 * for at least `minMs` milliseconds.
 *
 * Ported from Claude Code's useMinDisplayTime.ts.
 * Prevents fast-cycling progress text from flickering past before it's readable.
 *
 * Unlike debounce (wait for quiet) or throttle (limit rate), this guarantees
 * each value gets its minimum screen time before being replaced.
 */
import { useEffect, useRef, useState } from 'react';
export function useMinDisplayTime(value, minMs) {
    const [displayed, setDisplayed] = useState(value);
    const lastShownAtRef = useRef(0);
    useEffect(() => {
        const elapsed = Date.now() - lastShownAtRef.current;
        if (elapsed >= minMs) {
            lastShownAtRef.current = Date.now();
            setDisplayed(value);
            return;
        }
        const timer = setTimeout(() => {
            lastShownAtRef.current = Date.now();
            setDisplayed(value);
        }, minMs - elapsed);
        return () => clearTimeout(timer);
    }, [value, minMs]);
    return displayed;
}
//# sourceMappingURL=useMinDisplayTime.js.map