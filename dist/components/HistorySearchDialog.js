import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HistorySearchDialog — Search conversation messages.
 *
 * Text input for search query, filtered list of matching messages below.
 * Arrow keys to navigate results, Enter to select, Esc to cancel.
 */
import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function truncate(text, maxLen) {
    const clean = text.replace(/\n/g, ' ').trim();
    if (clean.length <= maxLen)
        return clean;
    return clean.slice(0, maxLen - 1) + '\u2026';
}
function highlight(text, query) {
    if (!query)
        return _jsx(Text, { children: text });
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx < 0)
        return _jsx(Text, { children: text });
    return (_jsxs(Text, { children: [text.slice(0, idx), _jsx(Text, { color: "yellow", bold: true, children: text.slice(idx, idx + query.length) }), text.slice(idx + query.length)] }));
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HistorySearchDialog({ messages, onSelect, onCancel, isActive = true, }) {
    const [query, setQuery] = useState('');
    const [cursorPos, setCursorPos] = useState(0);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const maxVisible = 15;
    // Filter messages by query
    const results = useMemo(() => {
        if (!query.trim())
            return messages.map((m, i) => ({ msg: m, origIdx: i }));
        const lower = query.toLowerCase();
        return messages
            .map((m, i) => ({ msg: m, origIdx: i }))
            .filter(({ msg }) => msg.content.toLowerCase().includes(lower));
    }, [messages, query]);
    // Clamp selection
    const clampedIdx = Math.min(selectedIdx, Math.max(0, results.length - 1));
    useInput((input, key) => {
        if (!isActive)
            return;
        // Escape — cancel
        if (key.escape) {
            if (query) {
                setQuery('');
                setCursorPos(0);
                setSelectedIdx(0);
            }
            else {
                onCancel();
            }
            return;
        }
        // Arrow navigation for results
        if (key.upArrow) {
            setSelectedIdx((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx((prev) => Math.min(results.length - 1, prev + 1));
            return;
        }
        // Enter — select
        if (key.return) {
            const result = results[clampedIdx];
            if (result)
                onSelect(result.origIdx);
            return;
        }
        // Backspace
        if (key.backspace || key.delete) {
            if (cursorPos > 0) {
                setQuery((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
                setCursorPos((prev) => prev - 1);
                setSelectedIdx(0);
            }
            return;
        }
        // Left/Right cursor
        if (key.leftArrow) {
            setCursorPos((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.rightArrow) {
            setCursorPos((prev) => Math.min(query.length, prev + 1));
            return;
        }
        // Ctrl+U — clear
        if (key.ctrl && input === 'u') {
            setQuery('');
            setCursorPos(0);
            setSelectedIdx(0);
            return;
        }
        // Regular character input
        if (input && !key.ctrl && !key.meta) {
            setQuery((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
            setCursorPos((prev) => prev + input.length);
            setSelectedIdx(0);
        }
    }, { isActive });
    // Render query with cursor
    const before = query.slice(0, cursorPos);
    const atCursor = cursorPos < query.length ? query[cursorPos] : undefined;
    const after = cursorPos < query.length ? query.slice(cursorPos + 1) : '';
    // Visible window of results
    const scrollStart = Math.max(0, clampedIdx - Math.floor(maxVisible / 2));
    const visibleResults = results.slice(scrollStart, scrollStart + maxVisible);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Search Messages" }), _jsx(Text, { dimColor: true, children: '  (\u2191\u2193 navigate, Enter select, Esc cancel)' })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: 'Search: ' }), _jsx(Text, { children: before }), _jsx(Text, { inverse: true, children: atCursor ?? ' ' }), _jsx(Text, { children: after }), _jsxs(Text, { dimColor: true, children: ['  ', "(", results.length, " result", results.length !== 1 ? 's' : '', ")"] })] }), results.length === 0 && query && (_jsxs(Text, { dimColor: true, children: ["No messages match \"", query, "\""] })), visibleResults.map((result, idx) => {
                const absIdx = scrollStart + idx;
                const isSelected = absIdx === clampedIdx;
                const roleColor = result.msg.role === 'user' ? 'blue' : 'green';
                const preview = truncate(result.msg.content, 60);
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsxs(Text, { color: roleColor, bold: true, children: ["[", result.msg.role, "]"] }), _jsx(Text, { children: " " }), query ? (highlight(preview, query)) : (_jsx(Text, { dimColor: true, children: preview }))] }, result.origIdx));
            }), results.length > maxVisible && (_jsxs(Text, { dimColor: true, children: ['\u2026 ', results.length - maxVisible, " more result", results.length - maxVisible !== 1 ? 's' : ''] }))] }));
}
//# sourceMappingURL=HistorySearchDialog.js.map