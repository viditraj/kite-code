import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * OutputStylePicker — Output verbosity selector.
 *
 * Three options (concise / normal / verbose) with descriptions.
 * Arrow keys + Enter to choose.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
const STYLES = [
    {
        style: 'concise',
        label: 'Concise',
        description: 'Brief, to-the-point responses',
        symbol: '\u25AB',
        color: 'green',
    },
    {
        style: 'normal',
        label: 'Normal',
        description: 'Balanced detail and brevity (default)',
        symbol: '\u25A0',
        color: 'cyan',
    },
    {
        style: 'verbose',
        label: 'Verbose',
        description: 'Detailed explanations and context',
        symbol: '\u25AC',
        color: 'yellow',
    },
];
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function OutputStylePicker({ current, onSelect, isActive = true, }) {
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const idx = STYLES.findIndex((s) => s.style === current);
        return idx >= 0 ? idx : 1;
    });
    useInput((input, key) => {
        if (!isActive)
            return;
        if (key.upArrow) {
            setSelectedIdx((prev) => (prev - 1 + STYLES.length) % STYLES.length);
            return;
        }
        if (key.downArrow) {
            setSelectedIdx((prev) => (prev + 1) % STYLES.length);
            return;
        }
        if (key.return) {
            const meta = STYLES[selectedIdx];
            if (meta)
                onSelect(meta.style);
            return;
        }
        // Left/Right arrows for quick adjustment
        if (key.leftArrow) {
            setSelectedIdx((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.rightArrow) {
            setSelectedIdx((prev) => Math.min(STYLES.length - 1, prev + 1));
            return;
        }
        // Number keys for quick select
        const num = parseInt(input, 10);
        if (num >= 1 && num <= STYLES.length) {
            const meta = STYLES[num - 1];
            if (meta)
                onSelect(meta.style);
            return;
        }
    }, { isActive });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Output Style" }), _jsx(Text, { dimColor: true, children: '  (\u2191\u2193 navigate, Enter select)' })] }), _jsxs(Box, { marginBottom: 1, children: [STYLES.map((meta, idx) => (_jsxs(Box, { children: [_jsx(Text, { color: idx <= selectedIdx ? meta.color : 'gray', children: meta.symbol }), idx < STYLES.length - 1 && (_jsx(Text, { color: "gray", children: '\u2500' }))] }, meta.style))), _jsx(Text, { children: '  ' }), _jsx(Text, { color: STYLES[selectedIdx]?.color, children: STYLES[selectedIdx]?.label })] }), STYLES.map((meta, idx) => {
                const isSelected = idx === selectedIdx;
                const isCurrent = meta.style === current;
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsx(Text, { dimColor: true, children: `${idx + 1}. ` }), _jsxs(Text, { color: meta.color, children: [meta.symbol, " "] }), _jsx(Text, { color: isSelected ? meta.color : undefined, bold: isSelected, children: meta.label }), isCurrent && _jsx(Text, { color: "green", children: ' (current)' }), _jsx(Text, { dimColor: true, children: `  ${meta.description}` })] }, meta.style));
            }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "This changes how detailed the AI's responses will be." }) })] }));
}
//# sourceMappingURL=OutputStylePicker.js.map