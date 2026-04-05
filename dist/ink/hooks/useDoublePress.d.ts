/**
 * useDoublePress — detect a rapid double-press of a key.
 *
 * Ported from Claude Code's useDoublePress.ts.
 * Creates a handler that calls one function on the first press and another
 * function on the second press within a configurable timeout window.
 *
 * Used for patterns like "press Escape once to show hint, twice to cancel".
 */
export declare const DOUBLE_PRESS_TIMEOUT_MS = 800;
/**
 * Returns a press handler function.
 *
 * @param setPending - Called with true on first press, false after timeout or second press
 * @param onDoublePress - Called on the second press within the timeout window
 * @param onFirstPress - Optional callback for the first press
 */
export declare function useDoublePress(setPending: (pending: boolean) => void, onDoublePress: () => void, onFirstPress?: () => void): () => void;
//# sourceMappingURL=useDoublePress.d.ts.map