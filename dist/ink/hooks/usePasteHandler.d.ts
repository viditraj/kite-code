/**
 * usePasteHandler — handle paste events in the terminal.
 *
 * Adapted from Claude Code's usePasteHandler.ts for Kite.
 * Detects paste events by monitoring input length (terminal pastes
 * deliver many characters at once vs. single keystrokes). Aggregates
 * chunked paste data and delivers a single paste event.
 *
 * Also handles image file path detection in pasted content.
 */
export interface PasteHandlerOptions {
    /** Callback for text paste events */
    onPaste?: (text: string) => void;
    /** Regular input handler (non-paste characters) */
    onInput: (input: string, key: PasteInputKey) => void;
    /** Optional callback for image file paths in pasted content */
    onImagePath?: (path: string) => void;
}
export interface PasteInputKey {
    escape?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    tab?: boolean;
}
export interface PasteState {
    chunks: string[];
    timeoutId: ReturnType<typeof setTimeout> | null;
}
export declare function usePasteHandler({ onPaste, onInput, onImagePath, }: PasteHandlerOptions): {
    wrappedOnInput: (input: string, key: PasteInputKey) => void;
    pasteState: PasteState;
    isPasting: boolean;
};
//# sourceMappingURL=usePasteHandler.d.ts.map