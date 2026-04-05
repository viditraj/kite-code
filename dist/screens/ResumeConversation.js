import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ResumeConversation — Session resume screen.
 *
 * Implements the same pattern as Claude Code's ResumeConversation.tsx:
 * - Lists recent sessions with titles and dates
 * - Arrow key navigation to select a session
 * - Enter to resume, Escape to cancel
 * - Loads session messages and restores conversation state
 */
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { listSessions, loadSession, } from '../utils/session.js';
// ============================================================================
// ResumeConversation Component
// ============================================================================
export const ResumeConversation = ({ onResume, onCancel, initialQuery, sessionId: directSessionId, }) => {
    const { exit } = useApp();
    const [sessions, setSessions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resuming, setResuming] = useState(false);
    // Load sessions on mount
    useEffect(() => {
        try {
            // If a direct session ID was provided, try to load it immediately
            if (directSessionId) {
                const session = loadSession(directSessionId);
                if (session) {
                    onResume(session.messages, session.metadata);
                    return;
                }
                setError(`Session not found: ${directSessionId}`);
            }
            const allSessions = listSessions(20);
            setSessions(allSessions);
            // If an initial query was provided, filter sessions
            if (initialQuery && allSessions.length > 0) {
                const query = initialQuery.toLowerCase();
                const matchIndex = allSessions.findIndex(s => s.title.toLowerCase().includes(query) ||
                    s.id.includes(query));
                if (matchIndex >= 0) {
                    setSelectedIndex(matchIndex);
                }
            }
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }, [directSessionId, initialQuery, onResume]);
    // Handle keyboard input
    useInput((input, key) => {
        if (resuming)
            return;
        // Escape to cancel
        if (key.escape || (key.ctrl && input === 'c')) {
            onCancel();
            return;
        }
        // Arrow keys to navigate
        if (key.upArrow) {
            setSelectedIndex(prev => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(prev => Math.min(sessions.length - 1, prev + 1));
            return;
        }
        // Enter to resume selected session
        if (key.return && sessions.length > 0) {
            const selected = sessions[selectedIndex];
            if (selected) {
                setResuming(true);
                try {
                    const session = loadSession(selected.id);
                    if (session) {
                        onResume(session.messages, session.metadata);
                    }
                    else {
                        setError(`Failed to load session: ${selected.id}`);
                        setResuming(false);
                    }
                }
                catch (err) {
                    setError(err.message);
                    setResuming(false);
                }
            }
            return;
        }
        // q to quit
        if (input === 'q') {
            onCancel();
            return;
        }
    });
    // Format date for display
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1)
            return 'just now';
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays < 7)
            return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };
    // Loading state
    if (loading) {
        return (_jsx(Box, { flexDirection: "column", paddingX: 2, children: _jsx(Text, { color: "yellow", children: "Loading sessions..." }) }));
    }
    // Error state
    if (error) {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 2, children: [_jsxs(Text, { color: "red", children: ["Error: ", error] }), _jsx(Text, { dimColor: true, children: "Press Escape to go back" })] }));
    }
    // Resuming state
    if (resuming) {
        return (_jsx(Box, { flexDirection: "column", paddingX: 2, children: _jsx(Text, { color: "cyan", children: "Resuming session..." }) }));
    }
    // Empty state
    if (sessions.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 2, children: [_jsx(Text, { bold: true, children: "Resume Conversation" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "No saved sessions found." }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Escape to go back" }) })] }));
    }
    // Session list
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "Resume Conversation" }), _jsxs(Text, { dimColor: true, children: [" (", sessions.length, " sessions)"] })] }), _jsx(Box, { flexDirection: "column", children: sessions.map((session, index) => {
                    const isSelected = index === selectedIndex;
                    return (_jsxs(Box, { marginBottom: 0, children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: isSelected ? '❯ ' : '  ' }), _jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: session.title.slice(0, 50) }), _jsxs(Text, { dimColor: true, children: [' ', "(", session.messageCount, " msgs, ", formatDate(session.updatedAt), ")"] })] }, session.id));
                }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\u2191/\u2193 navigate \u2022 Enter to resume \u2022 Esc to cancel" }) }), sessions[selectedIndex] && (_jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsxs(Text, { dimColor: true, children: ["ID: ", sessions[selectedIndex].id, " \u2022 Model: ", sessions[selectedIndex].model, " \u2022 CWD: ", sessions[selectedIndex].cwd] }) }))] }));
};
//# sourceMappingURL=ResumeConversation.js.map