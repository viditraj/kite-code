import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FuzzyPicker — Fuzzy search dropdown with text input and filtered list.
 *
 * Features a text input at the top for typing a search query, and a filtered
 * list below. Uses simple substring matching for fuzzy filtering. Supports
 * keyboard navigation (arrow keys, Enter to select, Esc to cancel).
 *
 * @example
 * <FuzzyPicker
 *   items={[
 *     { label: 'File A', value: 'a' },
 *     { label: 'File B', value: 'b', hint: 'modified' },
 *   ]}
 *   onSelect={(item) => console.log('Selected', item.value)}
 *   onCancel={() => console.log('Cancelled')}
 *   placeholder="Search files..."
 * />
 */
import { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
// ---------------------------------------------------------------------------
// Fuzzy filter — simple substring matching with character-order awareness.
// ---------------------------------------------------------------------------
function fuzzyMatch(query, text) {
    if (query.length === 0)
        return true;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    // Character-order fuzzy: every character in the query must appear in order
    let qi = 0;
    for (let i = 0; i < lower.length && qi < q.length; i++) {
        if (lower[i] === q[qi]) {
            qi++;
        }
    }
    return qi === q.length;
}
function fuzzyScore(query, text) {
    // Lower is better. Exact prefix match wins.
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    if (lower.startsWith(q))
        return 0;
    if (lower.includes(q))
        return 1;
    return 2;
}
// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------
function resolveColor(color, colors) {
    if (!color)
        return undefined;
    if (color in colors) {
        return colors[color];
    }
    return color;
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function FuzzyPicker({ items, onSelect, onCancel, placeholder = 'Type to search\u2026', isActive = true, visibleCount = 8, color, }) {
    const [, colors] = useTheme();
    const resolvedColor = resolveColor(color, colors) ?? colors.primary;
    const [query, setQuery] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);
    // Filter and sort items
    const filtered = useMemo(() => {
        if (query.length === 0)
            return items;
        return items
            .filter((item) => fuzzyMatch(query, item.label))
            .sort((a, b) => fuzzyScore(query, a.label) - fuzzyScore(query, b.label));
    }, [items, query]);
    // Reset focused index when query or items change
    useEffect(() => {
        setFocusedIndex(0);
    }, [query, items]);
    // Clamp focused index to valid range
    useEffect(() => {
        if (focusedIndex >= filtered.length) {
            setFocusedIndex(Math.max(0, filtered.length - 1));
        }
    }, [filtered.length, focusedIndex]);
    useInput((input, key) => {
        if (!isActive)
            return;
        // Escape → cancel
        if (key.escape) {
            onCancel();
            return;
        }
        // Enter → select
        if (key.return) {
            const item = filtered[focusedIndex];
            if (item) {
                onSelect(item);
            }
            return;
        }
        // Arrow navigation
        if (key.upArrow) {
            setFocusedIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setFocusedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
            return;
        }
        // Backspace
        if (key.backspace || key.delete) {
            setQuery((prev) => prev.slice(0, -1));
            return;
        }
        // Tab is ignored (don't insert)
        if (key.tab)
            return;
        // Regular character input
        if (input && !key.ctrl && !key.meta) {
            setQuery((prev) => prev + input);
        }
    }, { isActive });
    // Windowed view
    const windowStart = Math.max(0, Math.min(focusedIndex - Math.floor(visibleCount / 2), filtered.length - visibleCount));
    const visible = filtered.slice(windowStart, windowStart + visibleCount);
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: resolvedColor, paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: resolvedColor, bold: true, children: '\u276F ' }), _jsxs(Text, { children: [query.length > 0 ? query : '', query.length === 0 && (_jsx(Text, { dimColor: true, children: placeholder })), _jsx(Text, { inverse: true, children: " " })] })] }), filtered.length === 0 ? (_jsx(Text, { dimColor: true, children: "No matches" })) : (_jsx(Box, { flexDirection: "column", children: visible.map((item, i) => {
                    const actualIndex = windowStart + i;
                    const isFocused = actualIndex === focusedIndex;
                    return (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: isFocused ? resolvedColor : undefined, children: isFocused ? '\u276F ' : '  ' }), _jsx(Text, { color: isFocused ? resolvedColor : undefined, bold: isFocused, children: item.label }), item.hint && (_jsxs(Text, { dimColor: true, children: [' ', item.hint] }))] }, item.value));
                }) })), filtered.length > visibleCount && (_jsx(Box, { marginTop: 0, children: _jsxs(Text, { dimColor: true, children: [windowStart > 0 ? '\u2191 ' : '  ', filtered.length, " items", windowStart + visibleCount < filtered.length ? ' \u2193' : ''] }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, italic: true, children: "\\u2191/\\u2193 navigate \\u00B7 Enter select \\u00B7 Esc cancel" }) })] }));
}
export default FuzzyPicker;
//# sourceMappingURL=FuzzyPicker.js.map