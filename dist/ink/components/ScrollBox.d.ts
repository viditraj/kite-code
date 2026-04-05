/**
 * ScrollBox — Scrollable container for the REPL message area.
 *
 * Implements sticky-scroll behavior (auto-pins to bottom when new content arrives)
 * with keyboard navigation for scrolling through history.
 *
 * Inspired by Claude Code's ScrollBox.tsx with simplified viewport management.
 */
import React, { type PropsWithChildren } from 'react';
export interface ScrollBoxProps {
    /** Height of the scrollable viewport in rows. If not set, uses available terminal height. */
    height?: number;
    /** Whether to auto-scroll to bottom when new content is added */
    stickyScroll?: boolean;
    /** Whether this component is active for keyboard input */
    isActive?: boolean;
    /** Callback when scroll position changes */
    onScroll?: (offset: number, maxOffset: number) => void;
}
export declare const ScrollBox: React.FC<PropsWithChildren<ScrollBoxProps>>;
//# sourceMappingURL=ScrollBox.d.ts.map