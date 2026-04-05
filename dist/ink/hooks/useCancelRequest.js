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
import { useCallback, useRef } from 'react';
import { useInput } from 'ink';
const DEFAULT_DOUBLE_PRESS_TIMEOUT_MS = 800;
export function useCancelRequest(options) {
    const { abortController, onCancel, isActive, clearToolConfirmQueue, isStreaming = false, onFirstPress, doublePressTimeoutMs = DEFAULT_DOUBLE_PRESS_TIMEOUT_MS, onDoublePress, } = options;
    const lastPressRef = useRef(0);
    const pendingRef = useRef(false);
    const timeoutRef = useRef(undefined);
    const cancel = useCallback(() => {
        // Priority 1: Cancel running LLM request
        if (abortController && !abortController.signal.aborted) {
            clearToolConfirmQueue?.();
            abortController.abort();
            onCancel();
            return;
        }
        // Priority 2: Clear tool confirm queue
        if (clearToolConfirmQueue) {
            clearToolConfirmQueue();
        }
        // Priority 3: General cancel
        onCancel();
    }, [abortController, onCancel, clearToolConfirmQueue]);
    const handlePress = useCallback(() => {
        // If streaming, immediately cancel
        if (isStreaming) {
            cancel();
            return;
        }
        // Double-press pattern for exit
        if (onDoublePress) {
            const now = Date.now();
            const timeSinceLastPress = now - lastPressRef.current;
            const isDoublePress = timeSinceLastPress <= doublePressTimeoutMs &&
                timeoutRef.current !== undefined;
            if (isDoublePress) {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = undefined;
                }
                pendingRef.current = false;
                onDoublePress();
            }
            else {
                onFirstPress?.();
                pendingRef.current = true;
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                    pendingRef.current = false;
                    timeoutRef.current = undefined;
                }, doublePressTimeoutMs);
            }
            lastPressRef.current = now;
            return;
        }
        // Simple cancel
        cancel();
    }, [isStreaming, cancel, onDoublePress, onFirstPress, doublePressTimeoutMs]);
    // Listen for Escape and Ctrl+C
    useInput((input, key) => {
        if (key.escape) {
            handlePress();
        }
        else if (key.ctrl && input === 'c') {
            handlePress();
        }
    }, { isActive });
    return {
        isPending: pendingRef.current,
        cancel,
    };
}
//# sourceMappingURL=useCancelRequest.js.map