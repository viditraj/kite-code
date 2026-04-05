/**
 * SearchBar — Inline search input with match count display.
 *
 * Renders "Search: ___  (N/M matches)" with keyboard navigation:
 *   - Typing updates the query
 *   - Enter fires the search callback
 *   - n / N navigate between matches (when not typing)
 *   - Escape closes the search bar
 */
import React from 'react';
export interface SearchBarProps {
    /** Called when the user presses Enter to execute a search. */
    onSearch: (query: string) => void;
    /** Called when the user presses Escape to dismiss the bar. */
    onClose: () => void;
    /** Total number of matches for the current query. */
    matchCount?: number;
    /** 1-based index of the currently highlighted match. */
    currentMatch?: number;
    /** Whether this component receives keyboard input. Defaults to true. */
    isActive?: boolean;
    /** Called when the user presses 'n' to go to the next match. */
    onNextMatch?: () => void;
    /** Called when the user presses 'N' to go to the previous match. */
    onPrevMatch?: () => void;
}
export declare function SearchBar({ onSearch, onClose, matchCount, currentMatch, isActive, onNextMatch, onPrevMatch, }: SearchBarProps): React.ReactElement;
//# sourceMappingURL=SearchBar.d.ts.map