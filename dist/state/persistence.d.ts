/**
 * State persistence — save/load AppState to disk.
 *
 * Persists user preferences (theme, vim mode, output style, etc.)
 * to ~/.kite/state.json. Only a subset of the state is persisted —
 * runtime-only fields (provider, session, tokens) are excluded.
 */
import type { AppState, OutputStyle, EffortLevel } from './AppStateStore.js';
/** Subset of AppState that is persisted to disk. */
export interface PersistedState {
    vimMode: boolean;
    showThinking: boolean;
    fastMode: boolean;
    outputStyle: OutputStyle;
    effortLevel: EffortLevel;
    theme: string;
}
/**
 * Load persisted state from disk.
 * Returns partial AppState overrides, or an empty object if no state file exists.
 */
export declare function loadPersistedState(): Partial<AppState>;
/**
 * Save the persisted subset of AppState to disk.
 * Creates the ~/.kite directory if it doesn't exist.
 */
export declare function savePersistedState(state: AppState): void;
/**
 * Create an onChange handler that auto-persists state changes.
 * Debounces writes to avoid excessive disk I/O.
 */
export declare function createAutoSaveHandler(): (state: AppState) => void;
//# sourceMappingURL=persistence.d.ts.map