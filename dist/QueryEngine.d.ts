/**
 * Query orchestration engine.
 *
 * High-level wrapper around the query loop that manages:
 * - Provider creation from config
 * - Tool assembly and schema generation
 * - ToolUseContext construction
 * - Permission context wiring
 * - Conversation state management
 * - Session lifecycle
 *
 * This is what the REPL and CLI use to drive conversations.
 */
import type { LLMProvider, UnifiedMessage, TokenUsage } from './providers/types.js';
import type { Tools, ToolUseContext } from './Tool.js';
import type { ToolPermissionContext } from './types/permissions.js';
import type { QueryEvent, Terminal, QueryDeps } from './query/deps.js';
export interface QueryEngineOptions {
    provider: LLMProvider;
    tools: Tools;
    model: string;
    maxTokens: number;
    systemPrompt: string;
    cwd: string;
    maxTurns?: number;
    debug?: boolean;
    verbose?: boolean;
    isNonInteractiveSession?: boolean;
    permissionContext?: ToolPermissionContext;
    requestPrompt?: ToolUseContext['requestPrompt'];
    deps?: Partial<QueryDeps>;
}
export declare class QueryEngine {
    private provider;
    private tools;
    private model;
    private maxTokens;
    private systemPrompt;
    private cwd;
    private maxTurns;
    private debug;
    private verbose;
    private isNonInteractiveSession;
    private permissionContext;
    private requestPrompt;
    private deps;
    private conversation;
    private cumulativeUsage;
    private abortController;
    private appState;
    private readFileState;
    private inProgressToolUseIDs;
    private responseLength;
    constructor(options: QueryEngineOptions);
    /**
     * Run a query with the given user input.
     * Returns an async generator of events.
     */
    run(userInput: string): AsyncGenerator<QueryEvent, Terminal, undefined>;
    /**
     * Run a query and collect all events into an array.
     * Convenience method for non-streaming use cases.
     */
    runToCompletion(userInput: string): Promise<{
        events: QueryEvent[];
        terminal: Terminal;
        assistantText: string;
    }>;
    /** Get the current conversation history */
    getConversation(): ReadonlyArray<UnifiedMessage>;
    /** Add a message to the conversation (for external injection) */
    addMessage(message: UnifiedMessage): void;
    /** Clear conversation history */
    clearConversation(): void;
    /** Update the system prompt */
    setSystemPrompt(prompt: string): void;
    /** Update the permission context */
    setPermissionContext(context: ToolPermissionContext): void;
    /** Update tools (e.g., after MCP servers connect) */
    setTools(tools: Tools): void;
    /** Abort the current query */
    abort(): void;
    /** Get cumulative token usage */
    getUsage(): TokenUsage;
    private createToolUseContext;
    private createCanUseToolFn;
}
//# sourceMappingURL=QueryEngine.d.ts.map