/**
 * AppState React context — provides the global state store to the component tree.
 *
 * Ported from Claude Code's state/AppState.tsx.
 * Uses useSyncExternalStore for efficient subscriptions — components only
 * re-render when their selected slice of state actually changes.
 *
 * Usage:
 *   // At the root:
 *   <AppStateProvider store={store}>
 *     <App />
 *   </AppStateProvider>
 *
 *   // In any component:
 *   const vimMode = useAppState(s => s.vimMode)
 *   const setState = useSetAppState()
 *   setState(prev => ({ ...prev, vimMode: true }))
 */

import React, { createContext, useContext, useSyncExternalStore, useMemo } from 'react'
import type { AppState, AppStateStore } from './AppStateStore.js'

// ============================================================================
// Context
// ============================================================================

const AppStateContext = createContext<AppStateStore | null>(null)

// ============================================================================
// Provider
// ============================================================================

export interface AppStateProviderProps {
  store: AppStateStore
  children: React.ReactNode
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  store,
  children,
}) => {
  return React.createElement(
    AppStateContext.Provider,
    { value: store },
    children,
  )
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Subscribe to a slice of the AppState. The component only re-renders
 * when the selected value changes (referential equality).
 *
 * @param selector - Function that extracts the desired value from AppState
 */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStateContext)
  if (!store) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }

  // Memoize the selector to avoid recreating the snapshot function
  const getSnapshot = useMemo(
    () => () => selector(store.getState()),
    [store, selector],
  )

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}

/**
 * Get the setState function without subscribing to state changes.
 * Use this when you need to update state but don't need to read it.
 */
export function useSetAppState(): (updater: (prev: AppState) => AppState) => void {
  const store = useContext(AppStateContext)
  if (!store) {
    throw new Error('useSetAppState must be used within an AppStateProvider')
  }
  return store.setState
}

/**
 * Get the store directly. Use sparingly — prefer useAppState for reads
 * and useSetAppState for writes.
 */
export function useAppStateStore(): AppStateStore {
  const store = useContext(AppStateContext)
  if (!store) {
    throw new Error('useAppStateStore must be used within an AppStateProvider')
  }
  return store
}

/**
 * Safe version of useAppState that returns undefined when used outside
 * an AppStateProvider. Useful for components that may render before
 * the provider is mounted (e.g., error boundaries).
 */
export function useAppStateMaybeOutsideOfProvider<T>(
  selector: (state: AppState) => T,
): T | undefined {
  const store = useContext(AppStateContext)
  if (!store) return undefined

  const getSnapshot = useMemo(
    () => () => selector(store.getState()),
    [store, selector],
  )

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
