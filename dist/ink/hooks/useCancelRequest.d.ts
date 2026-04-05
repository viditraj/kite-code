/**
 * useCancelRequest — unified cancel/interrupt handler.
 *
 * Adapted from Claude Code's useCancelRequest.ts for Kite.
 * Manages cancel logic with priority ordering:
 * 1. Cancel running LLM request (if streaming)
 * 2. Pop queued commands
 * 3. Clear tool confirmation queue
 *
 * Integrates with the Escape key and Ctrl+C keybindings.
 */
export interface CancelRequestOptions {
    /** AbortController for the current LLM request */
    abortController?: AbortController;
    /** Callback when a cancel is triggered */
    onCancel: () => void;
    /** Whether the cancel handler should listen for input */
    isActive: boolean;
    /** Callback to clear tool confirmation queue */
    clearToolConfirmQueue?: () => void;
    /** Whether the model is currently streaming */
    isStreaming?: boolean;
    /** Optional callback for first press of double-press pattern */
    onFirstPress?: () => void;
    /** Time window for double-press to exit (ms) */
    doublePressTimeoutMs?: number;
    /** Callback when double-press is detected (e.g., exit app) */
    onDoublePress?: () => void;
}
export interface CancelRequestResult {
    /** Whether a cancel is pending (first press, waiting for second) */
    isPending: boolean;
    /** Trigger cancel programmatically */
    cancel: () => void;
}
export declare function useCancelRequest(options: CancelRequestOptions): CancelRequestResult;
//# sourceMappingURL=useCancelRequest.d.ts.map