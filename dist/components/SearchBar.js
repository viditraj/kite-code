import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SearchBar — Inline search input with match count display.
 *
 * Renders "Search: ___  (N/M matches)" with keyboard navigation:
 *   - Typing updates the query
 *   - Enter fires the search callback
 *   - n / N navigate between matches (when not typing)
 *   - Escape closes the search bar
 */
import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SearchBar({ onSearch, onClose, matchCount, currentMatch, isActive = true, onNextMatch, onPrevMatch, }) {
    const [query, setQuery] = useState('');
    const [cursorPos, setCursorPos] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const reset = useCallback(() => {
        setQuery('');
        setCursorPos(0);
        setSubmitted(false);
    }, []);
    useInput((input, key) => {
        // ---- Escape — close bar ----
        if (key.escape) {
            reset();
            onClose();
            return;
        }
        // ---- After submission, n/N navigate matches ----
        if (submitted) {
            if (input === 'n') {
                onNextMatch?.();
                return;
            }
            if (input === 'N') {
                onPrevMatch?.();
                return;
            }
            // Any other key re-enters editing mode
            setSubmitted(false);
            // Fall through to normal input handling below
        }
        // ---- Enter — execute search ----
        if (key.return) {
            if (query.length > 0) {
                setSubmitted(true);
                onSearch(query);
            }
            return;
        }
        // ---- Backspace ----
        if (key.backspace || key.delete) {
            if (cursorPos > 0) {
                setQuery((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
                setCursorPos((prev) => prev - 1);
            }
            return;
        }
        // ---- Left / Right arrows ----
        if (key.leftArrow) {
            setCursorPos((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.rightArrow) {
            setCursorPos((prev) => Math.min(query.length, prev + 1));
            return;
        }
        // ---- Ctrl+U — clear query ----
        if (key.ctrl && input === 'u') {
            setQuery('');
            setCursorPos(0);
            return;
        }
        // ---- Regular character input ----
        if (input && !key.ctrl && !key.meta) {
            setQuery((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
            setCursorPos((prev) => prev + input.length);
        }
    }, { isActive });
    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    // Render query with a visible cursor
    const before = query.slice(0, cursorPos);
    const atCursor = cursorPos < query.length ? query[cursorPos] : undefined;
    const after = cursorPos < query.length ? query.slice(cursorPos + 1) : '';
    const hasMatches = matchCount !== undefined;
    const matchInfo = hasMatches && currentMatch !== undefined
        ? `(${currentMatch}/${matchCount} matches)`
        : hasMatches
            ? `(${matchCount} matches)`
            : '';
    return (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: 'Search: ' }), _jsx(Text, { children: before }), isActive ? (_jsx(Text, { inverse: true, children: atCursor ?? ' ' })) : (_jsx(Text, { children: atCursor ?? '' })), _jsx(Text, { children: after }), matchInfo && (_jsxs(Text, { dimColor: true, children: ['  ', matchInfo] })), submitted && (_jsx(Text, { dimColor: true, children: '  [n/N navigate, Esc close]' }))] }));
}
//# sourceMappingURL=SearchBar.js.map