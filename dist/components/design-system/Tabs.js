import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * Tabs — Horizontal tab bar with keyboard navigation.
 *
 * Shows tabs in a horizontal row. The active tab is highlighted with inverse
 * styling. Use left/right arrow keys to navigate and the onSelect callback
 * fires when the active tab changes.
 *
 * @example
 * const [tab, setTab] = useState('general')
 * <Tabs
 *   tabs={[
 *     { label: 'General', value: 'general' },
 *     { label: 'Advanced', value: 'advanced' },
 *   ]}
 *   activeTab={tab}
 *   onSelect={setTab}
 * />
 */
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
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
export function Tabs({ tabs, activeTab, onSelect, isActive = true, color, }) {
    const [, colors] = useTheme();
    const resolvedColor = resolveColor(color, colors);
    // Track which index is active
    const activeIndex = Math.max(0, tabs.findIndex((t) => t.value === activeTab));
    const [focusedIndex, setFocusedIndex] = useState(activeIndex);
    // Keep focused index in sync with external activeTab changes
    useEffect(() => {
        const idx = tabs.findIndex((t) => t.value === activeTab);
        if (idx >= 0) {
            setFocusedIndex(idx);
        }
    }, [activeTab, tabs]);
    useInput((_input, key) => {
        if (!isActive || tabs.length === 0)
            return;
        if (key.leftArrow) {
            const newIndex = focusedIndex <= 0 ? tabs.length - 1 : focusedIndex - 1;
            setFocusedIndex(newIndex);
            const tab = tabs[newIndex];
            if (tab)
                onSelect(tab.value);
            return;
        }
        if (key.rightArrow) {
            const newIndex = focusedIndex >= tabs.length - 1 ? 0 : focusedIndex + 1;
            setFocusedIndex(newIndex);
            const tab = tabs[newIndex];
            if (tab)
                onSelect(tab.value);
            return;
        }
        if (key.return) {
            const tab = tabs[focusedIndex];
            if (tab)
                onSelect(tab.value);
            return;
        }
    }, { isActive });
    return (_jsx(Box, { flexDirection: "row", gap: 1, children: tabs.map((tab, i) => {
            const isCurrent = i === focusedIndex;
            const tabColor = resolvedColor ?? colors.primary;
            return (_jsxs(Text, { inverse: isCurrent, bold: isCurrent, color: isCurrent ? tabColor : undefined, dimColor: !isCurrent, children: [' ', tab.label, ' '] }, tab.value));
        }) }));
}
export default Tabs;
//# sourceMappingURL=Tabs.js.map