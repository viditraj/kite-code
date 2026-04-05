/**
 * Immutable state store with subscribe/notify pattern.
 *
 * Ported from Claude Code's state/store.ts.
 * A minimal, framework-agnostic store that React components can subscribe to
 * via useSyncExternalStore. Mutations are applied through an updater function
 * (prev => next), and all listeners are notified synchronously.
 */
// ============================================================================
// Factory
// ============================================================================
/**
 * Create a new immutable state store.
 *
 * @param initialState - The initial state object
 * @param onChange - Optional callback fired after every state change
 */
export function createStore(initialState, onChange) {
    let state = initialState;
    const listeners = new Set();
    return {
        getState() {
            return state;
        },
        setState(updater) {
            const next = updater(state);
            if (next === state)
                return; // No change — skip notification
            state = next;
            onChange?.(state);
            for (const listener of listeners) {
                listener();
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
//# sourceMappingURL=store.js.map