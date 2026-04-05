import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text } from 'ink';
import { useInterval } from '../../ink/hooks/useInterval.js';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80; // ms
const MODE_MESSAGES = {
    thinking: 'Thinking',
    working: 'Working',
    idle: 'Idle',
};
const MODE_COLORS = {
    thinking: 'yellow',
    working: 'cyan',
    idle: 'gray',
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatElapsed(startTime) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    if (elapsedSeconds < 60) {
        return `(${elapsedSeconds}s)`;
    }
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `(${minutes}m ${seconds}s)`;
}
// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner({ mode = 'thinking', message, showElapsed, startTime, }) {
    const [frameIndex, setFrameIndex] = useState(0);
    // Pause animation when idle (pass null delay)
    useInterval(() => {
        setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, mode === 'idle' ? null : FRAME_INTERVAL);
    const frame = SPINNER_FRAMES[frameIndex];
    const modeColor = MODE_COLORS[mode];
    const displayMessage = message ?? MODE_MESSAGES[mode];
    const elapsed = showElapsed && startTime != null ? (_jsxs(Text, { color: "gray", children: [" ", formatElapsed(startTime)] })) : null;
    return (_jsxs(Box, { children: [_jsxs(Text, { color: modeColor, children: [frame, " "] }), _jsx(Text, { children: displayMessage }), elapsed] }));
}
// ---------------------------------------------------------------------------
// SpinnerWithVerb
// ---------------------------------------------------------------------------
export function SpinnerWithVerb({ verb = '', color, }) {
    const [frameIndex, setFrameIndex] = useState(0);
    useInterval(() => {
        setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);
    const frame = SPINNER_FRAMES[frameIndex];
    return (_jsx(Box, { children: _jsxs(Text, { color: color, children: [frame, " ", verb] }) }));
}
//# sourceMappingURL=Spinner.js.map