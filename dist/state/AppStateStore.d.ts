/**
 * AppStateStore — typed global state for the Kite application.
 *
 * Ported from Claude Code's state/AppStateStore.ts.
 * Defines the full application state shape and provides a factory
 * function for default state. The store is created once at startup
 * and shared via React context.
 */
import type { LLMProvider } from '../providers/types.js';
import type { Tool } from '../Tool.js';
import type { Command } from '../types/command.js';
import { type Store } from './store.js';
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
export type OutputStyle = 'verbose' | 'concise' | 'brief';
export type EffortLevel = 'low' | 'medium' | 'high';
export interface MCPConnection {
    name: string;
    type: 'stdio' | 'sse' | 'http';
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    toolCount: number;
}
export interface TaskState {
    id: string;
    type: 'local_agent' | 'background_bash' | 'cron';
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    description: string;
    toolUseId?: string;
    startedAt: number;
    completedAt?: number;
}
export interface Notification {
    key: string;
    text: string;
    priority: 'immediate' | 'normal' | 'low';
    timeoutMs?: number;
}
/**
 * Core application state.
 *
 * Every field has a sensible default. Fields prefixed with _ are internal
 * and not intended for direct UI consumption (they're exposed for
 * compatibility with the existing ad-hoc appState pattern).
 */
export interface AppState {
    /** Currently active LLM provider instance */
    _provider?: LLMProvider;
    /** Loaded configuration */
    _config?: Record<string, unknown>;
    /** Active session ID (if persistence is enabled) */
    _sessionId?: string;
    /** Session start timestamp */
    sessionStartedAt: number;
    _permissionContext?: {
        mode: PermissionMode;
        prePlanMode?: PermissionMode;
        alwaysAllowRules?: Record<string, unknown>;
        alwaysDenyRules?: Record<string, unknown>;
    };
    _cumulativeUsage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
    };
    _mcpConnections?: Map<string, MCPConnection>;
    mcpTools: Tool[];
    mcpCommands: Command[];
    tasks: Record<string, TaskState>;
    notifications: {
        current: Notification | null;
        queue: Notification[];
    };
    vimMode: boolean;
    showThinking: boolean;
    fastMode: boolean;
    outputStyle: OutputStyle;
    effortLevel: EffortLevel;
    theme: string;
    taskList: Record<string, {
        id: string;
        subject: string;
        status: string;
    }>;
    gitBranch: string | null;
    gitModifiedCount: number;
    isGitRepo: boolean;
}
export declare function getDefaultAppState(): AppState;
export type AppStateStore = Store<AppState>;
/**
 * Create the global AppState store.
 *
 * @param overrides - Optional partial state to merge with defaults
 * @param onChange - Optional callback fired after every state change
 */
export declare function createAppStateStore(overrides?: Partial<AppState>, onChange?: (state: AppState) => void): AppStateStore;
//# sourceMappingURL=AppStateStore.d.ts.map