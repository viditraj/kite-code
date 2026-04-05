/**
 * useHistorySearch — search through command/message history with Ctrl+R.
 *
 * Adapted from Claude Code's useHistorySearch.ts for Kite.
 * Provides incremental search through conversation history with
 * keyboard navigation: Ctrl+R to start/next, Enter to accept, Escape to cancel.
 */
export interface HistoryEntry {
    /** The full text of the history entry */
    display: string;
    /** Optional metadata associated with the entry */
    metadata?: Record<string, unknown>;
}
export interface UseHistorySearchOptions {
    /** Full list of history entries (most recent first) */
    history: HistoryEntry[];
    /** Whether the hook should listen for input */
    isActive: boolean;
    /** Callback when a history entry is accepted */
    onAccept: (entry: HistoryEntry) => void;
    /** Current input value (saved/restored on search start/cancel) */
    currentInput: string;
    /** Callback to update the input display */
    onInputChange: (input: string) => void;
}
export interface UseHistorySearchResult {
    /** Whether history search mode is active */
    isSearching: boolean;
    /** Current search query string */
    historyQuery: string;
    /** The currently matched history entry, if any */
    historyMatch: HistoryEntry | undefined;
    /** Whether the search found no results */
    historyFailedMatch: boolean;
    /** Programmatically start searching */
    startSearch: () => void;
    /** Programmatically cancel searching */
    cancelSearch: () => void;
    /** Set the search query */
    setHistoryQuery: (query: string) => void;
}
export declare function useHistorySearch(options: UseHistorySearchOptions): UseHistorySearchResult;
//# sourceMappingURL=useHistorySearch.d.ts.map