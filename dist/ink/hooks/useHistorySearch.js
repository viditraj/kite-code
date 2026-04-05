/**
 * useHistorySearch — search through command/message history with Ctrl+R.
 *
 * Adapted from Claude Code's useHistorySearch.ts for Kite.
 * Provides incremental search through conversation history with
 * keyboard navigation: Ctrl+R to start/next, Enter to accept, Escape to cancel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInput } from 'ink';
export function useHistorySearch(options) {
    const { history, isActive, onAccept, currentInput, onInputChange } = options;
    const [isSearching, setIsSearching] = useState(false);
    const [historyQuery, setHistoryQuery] = useState('');
    const [historyFailedMatch, setHistoryFailedMatch] = useState(false);
    const [historyMatch, setHistoryMatch] = useState(undefined);
    const [originalInput, setOriginalInput] = useState('');
    // Index tracking for "next match" cycling
    const matchIndexRef = useRef(0);
    const seenPromptsRef = useRef(new Set());
    const reset = useCallback(() => {
        setIsSearching(false);
        setHistoryQuery('');
        setHistoryFailedMatch(false);
        setHistoryMatch(undefined);
        setOriginalInput('');
        matchIndexRef.current = 0;
        seenPromptsRef.current.clear();
    }, []);
    const startSearch = useCallback(() => {
        setIsSearching(true);
        setOriginalInput(currentInput);
        matchIndexRef.current = 0;
        seenPromptsRef.current.clear();
    }, [currentInput]);
    const cancelSearch = useCallback(() => {
        onInputChange(originalInput);
        reset();
    }, [onInputChange, originalInput, reset]);
    // Search through history when query changes
    const searchHistory = useCallback((resume) => {
        if (!isSearching || historyQuery.length === 0) {
            if (isSearching) {
                setHistoryMatch(undefined);
                setHistoryFailedMatch(false);
                onInputChange(originalInput);
            }
            return;
        }
        const startIdx = resume ? matchIndexRef.current + 1 : 0;
        if (!resume) {
            seenPromptsRef.current.clear();
        }
        for (let i = startIdx; i < history.length; i++) {
            const entry = history[i];
            const text = entry.display;
            const lowerText = text.toLowerCase();
            const lowerQuery = historyQuery.toLowerCase();
            if (lowerText.includes(lowerQuery) && !seenPromptsRef.current.has(text)) {
                seenPromptsRef.current.add(text);
                matchIndexRef.current = i;
                setHistoryMatch(entry);
                setHistoryFailedMatch(false);
                onInputChange(text);
                return;
            }
        }
        // No match found
        setHistoryFailedMatch(true);
    }, [isSearching, historyQuery, history, onInputChange, originalInput]);
    // Re-search when query changes
    useEffect(() => {
        if (isSearching) {
            searchHistory(false);
        }
    }, [historyQuery]);
    // Handle keyboard input during search
    useInput((input, key) => {
        if (!isSearching) {
            // Ctrl+R starts search
            if (key.ctrl && input === 'r') {
                startSearch();
            }
            return;
        }
        // Escape cancels search
        if (key.escape) {
            cancelSearch();
            return;
        }
        // Enter accepts current match
        if (key.return) {
            if (historyMatch) {
                onAccept(historyMatch);
            }
            reset();
            return;
        }
        // Ctrl+R finds next match
        if (key.ctrl && input === 'r') {
            searchHistory(true);
            return;
        }
        // Backspace removes last character from query
        if (key.backspace || key.delete) {
            if (historyQuery.length === 0) {
                cancelSearch();
            }
            else {
                setHistoryQuery(prev => prev.slice(0, -1));
            }
            return;
        }
        // Regular characters add to search query
        if (input && !key.ctrl && !key.meta && !key.tab) {
            setHistoryQuery(prev => prev + input);
        }
    }, { isActive });
    return {
        isSearching,
        historyQuery,
        historyMatch,
        historyFailedMatch,
        startSearch,
        cancelSearch,
        setHistoryQuery,
    };
}
//# sourceMappingURL=useHistorySearch.js.map