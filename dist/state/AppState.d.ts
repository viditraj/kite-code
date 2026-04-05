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
import React from 'react';
import type { AppState, AppStateStore } from './AppStateStore.js';
export interface AppStateProviderProps {
    store: AppStateStore;
    children: React.ReactNode;
}
export declare const AppStateProvider: React.FC<AppStateProviderProps>;
/**
 * Subscribe to a slice of the AppState. The component only re-renders
 * when the selected value changes (referential equality).
 *
 * @param selector - Function that extracts the desired value from AppState
 */
export declare function useAppState<T>(selector: (state: AppState) => T): T;
/**
 * Get the setState function without subscribing to state changes.
 * Use this when you need to update state but don't need to read it.
 */
export declare function useSetAppState(): (updater: (prev: AppState) => AppState) => void;
/**
 * Get the store directly. Use sparingly — prefer useAppState for reads
 * and useSetAppState for writes.
 */
export declare function useAppStateStore(): AppStateStore;
/**
 * Safe version of useAppState that returns undefined when used outside
 * an AppStateProvider. Useful for components that may render before
 * the provider is mounted (e.g., error boundaries).
 */
export declare function useAppStateMaybeOutsideOfProvider<T>(selector: (state: AppState) => T): T | undefined;
//# sourceMappingURL=AppState.d.ts.map