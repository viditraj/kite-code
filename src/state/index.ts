/**
 * State management — barrel exports.
 */

export { createStore, type Store, type Listener } from './store.js'
export {
  type AppState,
  type AppStateStore,
  type PermissionMode,
  type OutputStyle,
  type EffortLevel,
  type MCPConnection,
  type TaskState,
  type Notification,
  getDefaultAppState,
  createAppStateStore,
} from './AppStateStore.js'
export {
  AppStateProvider,
  useAppState,
  useSetAppState,
  useAppStateStore,
  useAppStateMaybeOutsideOfProvider,
  type AppStateProviderProps,
} from './AppState.js'
export {
  loadPersistedState,
  savePersistedState,
  createAutoSaveHandler,
  type PersistedState,
} from './persistence.js'
