/**
 * Immutable state store with subscribe/notify pattern.
 *
 * Ported from Claude Code's state/store.ts.
 * A minimal, framework-agnostic store that React components can subscribe to
 * via useSyncExternalStore. Mutations are applied through an updater function
 * (prev => next), and all listeners are notified synchronously.
 */
export type Listener = () => void;
export interface Store<T> {
    /** Get the current state snapshot. */
    getState: () => T;
    /** Apply an updater function to the state. */
    setState: (updater: (prev: T) => T) => void;
    /** Subscribe to state changes. Returns an unsubscribe function. */
    subscribe: (listener: Listener) => () => void;
}
/**
 * Create a new immutable state store.
 *
 * @param initialState - The initial state object
 * @param onChange - Optional callback fired after every state change
 */
export declare function createStore<T>(initialState: T, onChange?: (state: T) => void): Store<T>;
//# sourceMappingURL=store.d.ts.map