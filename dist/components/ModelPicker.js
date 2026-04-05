import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ModelPicker — Rich model selector with provider grouping and search.
 *
 * Displays models grouped by provider with color-coded labels.
 * Supports arrow-key navigation, Enter to select, Esc to cancel,
 * and type-ahead filtering.
 */
import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Provider colours
// ---------------------------------------------------------------------------
const PROVIDER_COLORS = {
    anthropic: 'magenta',
    openai: 'green',
    ollama: 'yellow',
    groq: 'cyan',
    deepseek: 'blue',
    mistral: 'red',
    openrouter: 'white',
};
function colorForProvider(provider) {
    return PROVIDER_COLORS[provider.toLowerCase()] ?? 'white';
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ModelPicker({ models, currentModel, onSelect, onCancel, isActive = true, }) {
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const idx = models.findIndex((m) => m.name === currentModel);
        return idx >= 0 ? idx : 0;
    });
    const [filter, setFilter] = useState('');
    // Filtered models based on search input
    const filtered = useMemo(() => {
        if (!filter)
            return models;
        const lower = filter.toLowerCase();
        return models.filter((m) => m.name.toLowerCase().includes(lower) ||
            m.provider.toLowerCase().includes(lower) ||
            (m.description ?? '').toLowerCase().includes(lower));
    }, [models, filter]);
    // Group filtered models by provider
    const grouped = useMemo(() => {
        const map = new Map();
        for (const m of filtered) {
            const existing = map.get(m.provider) ?? [];
            existing.push(m);
            map.set(m.provider, existing);
        }
        return map;
    }, [filtered]);
    // Build a flat list for keyboard navigation
    const flatList = useMemo(() => {
        const result = [];
        for (const items of grouped.values()) {
            result.push(...items);
        }
        return result;
    }, [grouped]);
    // Clamp selection when filter changes
    const clampedIdx = Math.min(selectedIdx, Math.max(0, flatList.length - 1));
    useInput((input, key) => {
        if (!isActive)
            return;
        // Escape — cancel
        if (key.escape) {
            if (filter) {
                setFilter('');
                setSelectedIdx(0);
            }
            else {
                onCancel();
            }
            return;
        }
        // Arrow navigation
        if (key.upArrow) {
            setSelectedIdx((prev) => (prev - 1 + flatList.length) % flatList.length);
            return;
        }
        if (key.downArrow) {
            setSelectedIdx((prev) => (prev + 1) % flatList.length);
            return;
        }
        // Enter — select
        if (key.return) {
            const model = flatList[clampedIdx];
            if (model)
                onSelect(model);
            return;
        }
        // Backspace — remove last filter char
        if (key.backspace || key.delete) {
            setFilter((prev) => prev.slice(0, -1));
            setSelectedIdx(0);
            return;
        }
        // Ctrl+U — clear filter
        if (key.ctrl && input === 'u') {
            setFilter('');
            setSelectedIdx(0);
            return;
        }
        // Regular character — append to filter
        if (input && !key.ctrl && !key.meta) {
            setFilter((prev) => prev + input);
            setSelectedIdx(0);
        }
    }, { isActive });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Select Model" }), _jsx(Text, { dimColor: true, children: '  (↑↓ navigate, Enter select, type to filter, Esc cancel)' })] }), filter && (_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "yellow", children: "Filter: " }), _jsx(Text, { children: filter }), _jsx(Text, { inverse: true, children: ' ' })] })), flatList.length === 0 && (_jsxs(Text, { dimColor: true, children: ["No models match \"", filter, "\""] })), Array.from(grouped.entries()).map(([provider, items]) => {
                const provColor = colorForProvider(provider);
                return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Box, { children: _jsx(Text, { color: provColor, bold: true, children: provider.charAt(0).toUpperCase() + provider.slice(1) }) }), items.map((model) => {
                            const flatIdx = flatList.indexOf(model);
                            const isSelected = flatIdx === clampedIdx;
                            const isCurrent = model.name === currentModel;
                            return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsx(Text, { color: isSelected ? provColor : undefined, bold: isSelected, children: model.name }), isCurrent && (_jsx(Text, { color: "green", children: ' (current)' })), model.description && (_jsx(Text, { dimColor: true, children: `  ${model.description}` }))] }, model.name));
                        })] }, provider));
            })] }));
}
//# sourceMappingURL=ModelPicker.js.map