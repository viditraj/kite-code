import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SessionPicker — interactive session selection screen.
 *
 * Shown when the user runs `kite -r` (resume) without a session ID.
 * Lists recent sessions with fuzzy search, matching Claude Code's
 * ResumeConversation → LogSelector pattern.
 *
 * Features:
 * - Lists recent sessions sorted by date
 * - Arrow key navigation
 * - Fuzzy search filtering (type to filter)
 * - Shows session title, date, model, message count
 * - Enter to select, Esc/Ctrl+C to cancel
 */
import { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { listSessions } from '../utils/session.js';
// ============================================================================
// Helpers
// ============================================================================
function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ago`;
    if (hours > 0)
        return `${hours}h ago`;
    if (minutes > 0)
        return `${minutes}m ago`;
    return 'just now';
}
function truncate(str, maxLen) {
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '\u2026' : str;
}
function fuzzyMatch(text, query) {
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    let qi = 0;
    for (let i = 0; i < lower.length && qi < q.length; i++) {
        if (lower[i] === q[qi])
            qi++;
    }
    return qi === q.length;
}
// ============================================================================
// SessionPicker Component
// ============================================================================
export const SessionPicker = ({ onSelect, onCancel, initialSearchQuery = '', }) => {
    const { exit } = useApp();
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Load all sessions on mount
    const allSessions = useMemo(() => listSessions(50), []);
    // Filter by search query
    const sessions = useMemo(() => {
        if (!searchQuery)
            return allSessions;
        return allSessions.filter(s => fuzzyMatch(s.title, searchQuery) ||
            fuzzyMatch(s.id, searchQuery) ||
            fuzzyMatch(s.model, searchQuery));
    }, [allSessions, searchQuery]);
    // Clamp index
    const clampedIndex = Math.min(selectedIndex, Math.max(0, sessions.length - 1));
    useInput((input, key) => {
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.ctrl && input === 'c') {
            onCancel();
            exit();
            return;
        }
        if (key.return) {
            if (sessions.length > 0 && sessions[clampedIndex]) {
                onSelect(sessions[clampedIndex]);
            }
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(prev => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(prev => Math.min(sessions.length - 1, prev + 1));
            return;
        }
        if (key.backspace || key.delete) {
            setSearchQuery(prev => prev.slice(0, -1));
            setSelectedIndex(0);
            return;
        }
        // Regular character input for search
        if (input && !key.ctrl && !key.meta) {
            setSearchQuery(prev => prev + input);
            setSelectedIndex(0);
        }
    });
    // No sessions at all
    if (allSessions.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [_jsx(Text, { children: "No conversations found to resume." }), _jsx(Text, { dimColor: true, children: "Start a new conversation by running: kite" })] }));
    }
    const PAGE_SIZE = Math.min(15, sessions.length);
    // Compute visible window around the selected index
    const halfPage = Math.floor(PAGE_SIZE / 2);
    let startIdx = Math.max(0, clampedIndex - halfPage);
    const endIdx = Math.min(sessions.length, startIdx + PAGE_SIZE);
    if (endIdx - startIdx < PAGE_SIZE) {
        startIdx = Math.max(0, endIdx - PAGE_SIZE);
    }
    const visibleSessions = sessions.slice(startIdx, endIdx);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Resume a conversation" }) }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: "Search: " }), searchQuery ? (_jsxs(Text, { children: [searchQuery, _jsx(Text, { inverse: true, children: " " })] })) : (_jsxs(Text, { dimColor: true, children: ["Type to filter...", _jsx(Text, { inverse: true, children: " " })] })), _jsxs(Text, { dimColor: true, children: ["  (", sessions.length, " of ", allSessions.length, ")"] })] }), sessions.length === 0 ? (_jsx(Box, { paddingY: 1, children: _jsxs(Text, { dimColor: true, children: ["No sessions match \"", searchQuery, "\""] }) })) : (_jsxs(Box, { flexDirection: "column", children: [visibleSessions.map((session, i) => {
                        const absoluteIndex = startIdx + i;
                        const isSelected = absoluteIndex === clampedIndex;
                        return (_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: isSelected ? '\u276f ' : '  ' }), _jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: truncate(session.title, 50).padEnd(50) }), _jsxs(Text, { dimColor: true, children: [' ', formatRelativeTime(session.updatedAt).padEnd(8)] }), _jsxs(Text, { dimColor: true, children: [' ', session.model.padEnd(25)] }), _jsxs(Text, { dimColor: true, children: [' ', session.id] })] }, session.id));
                    }), sessions.length > PAGE_SIZE && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { dimColor: true, children: ["Showing ", startIdx + 1, "-", endIdx, " of ", sessions.length, startIdx > 0 ? ' \u2191' : '', endIdx < sessions.length ? ' \u2193' : ''] }) }))] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: '\u2191\u2193 navigate  Enter select  Esc cancel  Type to search' }) })] }));
};
//# sourceMappingURL=SessionPicker.js.map