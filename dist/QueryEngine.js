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
import { emptyUsage } from './providers/types.js';
import { createEmptyToolPermissionContext } from './types/permissions.js';
import { hasPermissionsToUseTool } from './utils/permissions/permissions.js';
import { query } from './query.js';
export class QueryEngine {
    provider;
    tools;
    model;
    maxTokens;
    systemPrompt;
    cwd;
    maxTurns;
    debug;
    verbose;
    isNonInteractiveSession;
    permissionContext;
    requestPrompt;
    deps;
    // Conversation state
    conversation = [];
    cumulativeUsage = emptyUsage();
    abortController = new AbortController();
    // Application state (shared across tools)
    appState = {};
    readFileState = new Map();
    inProgressToolUseIDs = new Set();
    responseLength = 0;
    constructor(options) {
        this.provider = options.provider;
        this.tools = options.tools;
        this.model = options.model;
        this.maxTokens = options.maxTokens;
        this.systemPrompt = options.systemPrompt;
        this.cwd = options.cwd;
        this.maxTurns = options.maxTurns ?? 100;
        this.debug = options.debug ?? false;
        this.verbose = options.verbose ?? false;
        this.isNonInteractiveSession = options.isNonInteractiveSession ?? false;
        this.permissionContext = options.permissionContext ?? createEmptyToolPermissionContext();
        this.requestPrompt = options.requestPrompt;
        this.deps = options.deps;
    }
    // ========================================================================
    // Public API
    // ========================================================================
    /**
     * Run a query with the given user input.
     * Returns an async generator of events.
     */
    async *run(userInput) {
        // Add user message
        this.conversation.push({ role: 'user', content: userInput });
        // Store provider in app state so tools (AgentTool, WebSearchTool) can access it
        this.appState._provider = this.provider;
        this.appState._permissionContext = this.permissionContext;
        const toolUseContext = this.createToolUseContext();
        const canUseTool = this.createCanUseToolFn();
        const result = yield* query({
            provider: this.provider,
            messages: this.conversation,
            systemPrompt: this.systemPrompt,
            tools: this.tools,
            toolUseContext,
            canUseTool,
            permissionContext: this.permissionContext,
            model: this.model,
            maxTokens: this.maxTokens,
            maxTurns: this.maxTurns,
            deps: this.deps,
        });
        // Update conversation from final query state
        if (result.finalMessages) {
            this.conversation = [...result.finalMessages];
        }
        return result;
    }
    /**
     * Run a query and collect all events into an array.
     * Convenience method for non-streaming use cases.
     */
    async runToCompletion(userInput) {
        const events = [];
        let assistantText = '';
        const gen = this.run(userInput);
        let result = await gen.next();
        while (!result.done) {
            events.push(result.value);
            if (result.value.type === 'text_delta') {
                assistantText += result.value.text;
            }
            result = await gen.next();
        }
        // Update conversation from final messages returned by query loop
        if (result.value.finalMessages) {
            this.conversation = [...result.value.finalMessages];
        }
        return {
            events,
            terminal: result.value,
            assistantText,
        };
    }
    /** Get the current conversation history */
    getConversation() {
        return this.conversation;
    }
    /** Add a message to the conversation (for external injection) */
    addMessage(message) {
        this.conversation.push(message);
    }
    /** Clear conversation history */
    clearConversation() {
        this.conversation = [];
        this.readFileState.clear();
        this.inProgressToolUseIDs.clear();
        this.responseLength = 0;
    }
    /** Update the system prompt */
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }
    /** Update the permission context */
    setPermissionContext(context) {
        this.permissionContext = context;
    }
    /** Update tools (e.g., after MCP servers connect) */
    setTools(tools) {
        this.tools = tools;
    }
    /** Abort the current query */
    abort() {
        this.abortController.abort('user_abort');
        // Create a fresh controller for the next query
        this.abortController = new AbortController();
    }
    /** Get cumulative token usage */
    getUsage() {
        return { ...this.cumulativeUsage };
    }
    // ========================================================================
    // Private methods
    // ========================================================================
    createToolUseContext() {
        return {
            abortController: this.abortController,
            options: {
                tools: this.tools,
                commands: [],
                debug: this.debug,
                verbose: this.verbose,
                mainLoopModel: this.model,
                isNonInteractiveSession: this.isNonInteractiveSession,
                refreshTools: () => this.tools,
            },
            messages: this.conversation,
            getCwd: () => this.cwd,
            getAppState: () => this.appState,
            setAppState: (f) => {
                this.appState = f(this.appState);
            },
            readFileState: {
                has: (path) => this.readFileState.has(path),
                get: (path) => this.readFileState.get(path),
                set: (path, value) => this.readFileState.set(path, value),
            },
            setInProgressToolUseIDs: (f) => {
                this.inProgressToolUseIDs = f(this.inProgressToolUseIDs);
            },
            setResponseLength: (f) => {
                this.responseLength = f(this.responseLength);
            },
            requestPrompt: this.requestPrompt,
        };
    }
    createCanUseToolFn() {
        return async (tool, input, context, _assistantMessage, _toolUseID) => {
            const decision = await hasPermissionsToUseTool({
                name: tool.name,
                mcpInfo: tool.mcpInfo,
                inputSchema: tool.inputSchema,
                checkPermissions: (parsedInput, ctx) => tool.checkPermissions(parsedInput, ctx),
                requiresUserInteraction: tool.requiresUserInteraction,
            }, input, this.permissionContext, context);
            // Map PermissionDecision to the PermissionResult expected by CanUseToolFn
            return {
                behavior: decision.behavior === 'deny' ? 'deny' : decision.behavior === 'ask' ? 'ask' : 'allow',
                updatedInput: 'updatedInput' in decision ? decision.updatedInput : undefined,
                message: 'message' in decision ? decision.message : undefined,
            };
        };
    }
}
//# sourceMappingURL=QueryEngine.js.map