/**
 * Immutable state store with subscribe/notify pattern.
 *
 * Ported from Claude Code's state/store.ts.
 * A minimal, framework-agnostic store that React components can subscribe to
 * via useSyncExternalStore. Mutations are applied through an updater function
 * (prev => next), and all listeners are notified synchronously.
 */

// ============================================================================
// Types
// ============================================================================

export type Listener = () => void

export interface Store<T> {
  /** Get the current state snapshot. */
  getState: () => T
  /** Apply an updater function to the state. */
  setState: (updater: (prev: T) => T) => void
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (listener: Listener) => () => void
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new immutable state store.
 *
 * @param initialState - The initial state object
 * @param onChange - Optional callback fired after every state change
 */
export function createStore<T>(
  initialState: T,
  onChange?: (state: T) => void,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState() {
      return state
    },

    setState(updater: (prev: T) => T) {
      const next = updater(state)
      if (next === state) return // No change — skip notification
      state = next
      onChange?.(state)
      for (const listener of listeners) {
        listener()
      }
    },

    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
