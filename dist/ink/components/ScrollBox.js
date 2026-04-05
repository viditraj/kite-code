import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ScrollBox — Scrollable container for the REPL message area.
 *
 * Implements sticky-scroll behavior (auto-pins to bottom when new content arrives)
 * with keyboard navigation for scrolling through history.
 *
 * Inspired by Claude Code's ScrollBox.tsx with simplified viewport management.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTerminalSize } from '../../ink/hooks/useTerminalSize.js';
// ============================================================================
// ScrollBox Component
// ============================================================================
export const ScrollBox = ({ children, height, stickyScroll = true, isActive = true, onScroll, }) => {
    const { rows: termRows } = useTerminalSize();
    const viewportHeight = height ?? Math.max(termRows - 10, 5); // Reserve space for input/status
    const [scrollOffset, setScrollOffset] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const [isSticky, setIsSticky] = useState(stickyScroll);
    const prevChildCountRef = useRef(0);
    // Count children to detect new content
    const childArray = React.Children.toArray(children);
    const childCount = childArray.length;
    // Calculate max scroll offset
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    // Estimate content height from children (each child ~1-4 rows)
    useEffect(() => {
        // Simple heuristic: each message is ~3 rows on average
        const estimated = childCount * 3;
        setContentHeight(estimated);
    }, [childCount]);
    // Auto-scroll to bottom when new content arrives (if sticky)
    useEffect(() => {
        if (childCount > prevChildCountRef.current && isSticky) {
            setScrollOffset(Math.max(0, contentHeight - viewportHeight));
        }
        prevChildCountRef.current = childCount;
    }, [childCount, contentHeight, viewportHeight, isSticky]);
    // Keyboard scrolling
    useInput((input, key) => {
        if (!isActive)
            return;
        // Page Up / Shift+Up
        if (key.upArrow && key.shift) {
            const newOffset = Math.max(0, scrollOffset - Math.floor(viewportHeight / 2));
            setScrollOffset(newOffset);
            setIsSticky(false);
            onScroll?.(newOffset, maxOffset);
            return;
        }
        // Page Down / Shift+Down
        if (key.downArrow && key.shift) {
            const newOffset = Math.min(maxOffset, scrollOffset + Math.floor(viewportHeight / 2));
            setScrollOffset(newOffset);
            setIsSticky(newOffset >= maxOffset);
            onScroll?.(newOffset, maxOffset);
            return;
        }
        // Ctrl+U — scroll up half page (vim-style)
        if (key.ctrl && input === 'u') {
            const newOffset = Math.max(0, scrollOffset - Math.floor(viewportHeight / 2));
            setScrollOffset(newOffset);
            setIsSticky(false);
            onScroll?.(newOffset, maxOffset);
            return;
        }
        // Ctrl+D — scroll down half page (vim-style)
        if (key.ctrl && input === 'd') {
            const newOffset = Math.min(maxOffset, scrollOffset + Math.floor(viewportHeight / 2));
            setScrollOffset(newOffset);
            setIsSticky(newOffset >= maxOffset);
            onScroll?.(newOffset, maxOffset);
            return;
        }
    }, { isActive });
    // Determine which children to show based on scroll position
    // We show all children and let Ink handle clipping via height constraint
    // For a lightweight approach: slice children based on estimated positions
    const startIdx = Math.max(0, Math.floor(scrollOffset / 3));
    const endIdx = Math.min(childCount, startIdx + Math.ceil(viewportHeight / 2) + 2);
    const visibleChildren = childArray.slice(startIdx, endIdx);
    // Scrollbar indicator
    const showScrollbar = contentHeight > viewportHeight;
    const scrollbarPosition = maxOffset > 0
        ? Math.round((scrollOffset / maxOffset) * Math.max(1, viewportHeight - 3))
        : 0;
    return (_jsxs(Box, { flexDirection: "row", height: viewportHeight, children: [_jsx(Box, { flexDirection: "column", flexGrow: 1, overflow: "hidden", children: visibleChildren }), showScrollbar && (_jsx(Box, { flexDirection: "column", width: 1, marginLeft: 1, children: Array.from({ length: Math.min(viewportHeight, 20) }, (_, i) => {
                    const isThumb = i >= scrollbarPosition && i < scrollbarPosition + 2;
                    return (_jsx(Text, { color: isThumb ? 'cyan' : undefined, dimColor: !isThumb, children: isThumb ? '█' : '│' }, i));
                }) }))] }));
};
//# sourceMappingURL=ScrollBox.js.map