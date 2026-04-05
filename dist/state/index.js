/**
 * State management — barrel exports.
 */
export { createStore } from './store.js';
export { getDefaultAppState, createAppStateStore, } from './AppStateStore.js';
export { AppStateProvider, useAppState, useSetAppState, useAppStateStore, useAppStateMaybeOutsideOfProvider, } from './AppState.js';
export { loadPersistedState, savePersistedState, createAutoSaveHandler, } from './persistence.js';
//# sourceMappingURL=index.js.map