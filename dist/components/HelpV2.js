import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HelpV2 — Rich help screen with categorized commands.
 *
 * Groups commands by category, shows them as sections with headers.
 * Arrow keys to scroll, Esc to close.
 */
import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HelpV2({ commands, onClose, isActive = true, }) {
    const [scrollOffset, setScrollOffset] = useState(0);
    // Group commands by category
    const grouped = useMemo(() => {
        const map = new Map();
        for (const cmd of commands) {
            const existing = map.get(cmd.category) ?? [];
            existing.push(cmd);
            map.set(cmd.category, existing);
        }
        return map;
    }, [commands]);
    // Build flat list of lines for scroll tracking
    const lines = useMemo(() => {
        const result = [];
        for (const [category, cmds] of grouped.entries()) {
            result.push({ type: 'header', category });
            for (const cmd of cmds) {
                result.push({ type: 'command', command: cmd });
            }
        }
        return result;
    }, [grouped]);
    const maxVisible = 20;
    const maxScroll = Math.max(0, lines.length - maxVisible);
    useInput((input, key) => {
        if (!isActive)
            return;
        if (key.escape || input === 'q') {
            onClose();
            return;
        }
        // Scroll up
        if (key.upArrow || input === 'k') {
            setScrollOffset((prev) => Math.max(0, prev - 1));
            return;
        }
        // Scroll down
        if (key.downArrow || input === 'j') {
            setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
            return;
        }
        // Page up
        if (key.ctrl && input === 'u') {
            setScrollOffset((prev) => Math.max(0, prev - Math.floor(maxVisible / 2)));
            return;
        }
        // Page down
        if (key.ctrl && input === 'd') {
            setScrollOffset((prev) => Math.min(maxScroll, prev + Math.floor(maxVisible / 2)));
            return;
        }
        // Home
        if (input === 'g') {
            setScrollOffset(0);
            return;
        }
        // End
        if (input === 'G') {
            setScrollOffset(maxScroll);
            return;
        }
    }, { isActive });
    const visibleLines = lines.slice(scrollOffset, scrollOffset + maxVisible);
    const hasMore = scrollOffset + maxVisible < lines.length;
    const hasLess = scrollOffset > 0;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, borderStyle: "single", borderColor: "cyan", paddingX: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Kite Help" }), _jsxs(Text, { dimColor: true, children: ['  ', commands.length, " commands"] })] }), hasLess && (_jsx(Text, { dimColor: true, children: '\u2191 scroll up for more' })), visibleLines.map((line, idx) => {
                if (line.type === 'header') {
                    return (_jsx(Box, { marginTop: idx > 0 ? 1 : 0, children: _jsxs(Text, { color: "yellow", bold: true, children: ['\u2500\u2500 ', line.category, ' \u2500\u2500'] }) }, `header-${line.category}`));
                }
                const cmd = line.command;
                return (_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", bold: true, children: ['  ', cmd.name] }), cmd.aliases && cmd.aliases.length > 0 && (_jsxs(Text, { dimColor: true, children: [' (', cmd.aliases.join(', '), ')'] })), _jsx(Text, { dimColor: true, children: '  \u2014 ' }), _jsx(Text, { children: cmd.description })] }, cmd.name));
            }), hasMore && (_jsx(Text, { dimColor: true, children: '\u2193 scroll down for more' })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: 'j/k or \u2191\u2193 to scroll \u00B7 q or Esc to close' }) })] }));
}
//# sourceMappingURL=HelpV2.js.map