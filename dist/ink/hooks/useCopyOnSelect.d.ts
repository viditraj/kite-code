/**
 * useCopyOnSelect — auto-copy selected text to clipboard.
 *
 * Adapted from Claude Code's useCopyOnSelect.ts for Kite.
 * Monitors a selection state and copies text to the system clipboard
 * when a selection completes (mouse-up with non-empty selection).
 *
 * In terminal environments, this provides a clipboard bridge since
 * Cmd/Ctrl+C is intercepted by the terminal for SIGINT.
 */
export interface SelectionState {
    text: string;
    isDragging: boolean;
    hasSelection: boolean;
}
/**
 * Hook that copies text to clipboard when selection completes.
 *
 * @param isActive - Whether to listen for selection changes
 * @param onCopied - Optional callback when text is copied
 * @returns Object with handleSelectionChange function
 */
export declare function useCopyOnSelect(isActive: boolean, onCopied?: (text: string) => void): {
    handleSelectionChange: (state: SelectionState) => void;
    copyText: (text: string) => boolean;
};
//# sourceMappingURL=useCopyOnSelect.d.ts.map