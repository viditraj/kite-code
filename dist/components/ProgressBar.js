import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProgressBar({ percent, width = 40, label, color = 'green', }) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filledWidth = Math.round((clamped / 100) * width);
    const emptyWidth = width - filledWidth;
    const filled = '\u2588'.repeat(filledWidth); // █
    const empty = '\u2591'.repeat(emptyWidth); // ░
    const percentText = `${Math.round(clamped)}%`;
    return (_jsxs(Box, { children: [label && (_jsxs(Text, { children: [label, ' '] })), _jsx(Text, { color: color, children: filled }), _jsx(Text, { dimColor: true, children: empty }), _jsxs(Text, { children: [" ", percentText] })] }));
}
//# sourceMappingURL=ProgressBar.js.map