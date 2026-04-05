import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EffortCallout — Effort level selector.
 *
 * Presents three effort levels (low, medium, high) with descriptions.
 * Arrow keys + Enter to choose, inspired by Claude Code's effort picker.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
const LEVELS = [
    {
        level: 'low',
        label: 'Low',
        description: 'Fast, less thorough — quick answers',
        symbol: '\u25CB',
        color: 'green',
    },
    {
        level: 'medium',
        label: 'Medium',
        description: 'Balanced speed and quality',
        symbol: '\u25D1',
        color: 'yellow',
    },
    {
        level: 'high',
        label: 'High',
        description: 'Slower, more thorough — deeper analysis',
        symbol: '\u25CF',
        color: 'red',
    },
];
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EffortCallout({ current, onSelect, isActive = true, }) {
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const idx = LEVELS.findIndex((l) => l.level === current);
        return idx >= 0 ? idx : 1;
    });
    useInput((input, key) => {
        if (!isActive)
            return;
        if (key.upArrow) {
            setSelectedIdx((prev) => (prev - 1 + LEVELS.length) % LEVELS.length);
            return;
        }
        if (key.downArrow) {
            setSelectedIdx((prev) => (prev + 1) % LEVELS.length);
            return;
        }
        if (key.return) {
            const meta = LEVELS[selectedIdx];
            if (meta)
                onSelect(meta.level);
            return;
        }
        // Left/Right arrows to adjust effort level
        if (key.leftArrow) {
            setSelectedIdx((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.rightArrow) {
            setSelectedIdx((prev) => Math.min(LEVELS.length - 1, prev + 1));
            return;
        }
    }, { isActive });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Effort Level" }), _jsx(Text, { dimColor: true, children: '  (\u2191\u2193 navigate, \u2190\u2192 adjust, Enter select)' })] }), _jsxs(Box, { marginBottom: 1, children: [LEVELS.map((meta, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: idx <= selectedIdx ? meta.color : 'gray', children: meta.symbol }), idx < LEVELS.length - 1 && (_jsx(Text, { color: idx < selectedIdx ? 'gray' : 'gray', children: '\u2500' }))] }, meta.level))), _jsxs(Text, { children: ['  ', LEVELS[selectedIdx]?.label ?? ''] })] }), LEVELS.map((meta, idx) => {
                const isSelected = idx === selectedIdx;
                const isCurrent = meta.level === current;
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsxs(Text, { color: meta.color, children: [meta.symbol, " "] }), _jsx(Text, { color: isSelected ? meta.color : undefined, bold: isSelected, children: meta.label }), isCurrent && _jsx(Text, { color: "green", children: ' (current)' }), _jsx(Text, { dimColor: true, children: `  ${meta.description}` })] }, meta.level));
            })] }));
}
//# sourceMappingURL=EffortCallout.js.map