import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ThinkingToggle — Simple toggle UI for thinking mode.
 *
 * Shows "Thinking: ON/OFF" with a visual toggle indicator.
 * Enter to toggle, renders inline.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ThinkingToggle({ enabled, onToggle, }) {
    const [focused, setFocused] = useState(false);
    useInput((input, key) => {
        if (key.return) {
            onToggle();
            return;
        }
        if (input === ' ') {
            onToggle();
            return;
        }
    });
    const toggleIndicator = enabled ? '[\u25CF\u25CB]' : '[\u25CB\u25CF]';
    const statusColor = enabled ? 'green' : 'red';
    const statusText = enabled ? 'ON' : 'OFF';
    return (_jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Thinking: " }), _jsx(Text, { color: statusColor, bold: true, children: toggleIndicator }), _jsx(Text, { children: " " }), _jsx(Text, { color: statusColor, bold: true, children: statusText }), _jsx(Text, { dimColor: true, children: '  (Enter to toggle)' })] }));
}
//# sourceMappingURL=ThinkingToggle.js.map