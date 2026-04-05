/**
 * AppStateStore — typed global state for the Kite application.
 *
 * Ported from Claude Code's state/AppStateStore.ts.
 * Defines the full application state shape and provides a factory
 * function for default state. The store is created once at startup
 * and shared via React context.
 */
import { createStore } from './store.js';
// ============================================================================
// Default state
// ============================================================================
export function getDefaultAppState() {
    return {
        sessionStartedAt: Date.now(),
        mcpTools: [],
        mcpCommands: [],
        tasks: {},
        notifications: {
            current: null,
            queue: [],
        },
        vimMode: false,
        showThinking: false,
        fastMode: false,
        outputStyle: 'concise',
        effortLevel: 'medium',
        theme: 'default',
        taskList: {},
        gitBranch: null,
        gitModifiedCount: 0,
        isGitRepo: false,
    };
}
/**
 * Create the global AppState store.
 *
 * @param overrides - Optional partial state to merge with defaults
 * @param onChange - Optional callback fired after every state change
 */
export function createAppStateStore(overrides, onChange) {
    const initial = {
        ...getDefaultAppState(),
        ...overrides,
    };
    return createStore(initial, onChange);
}
//# sourceMappingURL=AppStateStore.js.map