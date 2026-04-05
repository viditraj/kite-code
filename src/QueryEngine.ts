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

import type {
  LLMProvider,
  UnifiedMessage,
  ContentBlock,
  TokenUsage,
} from './providers/types.js'
import { emptyUsage, addUsage } from './providers/types.js'
import type { Tool, Tools, ToolUseContext, CanUseToolFn } from './Tool.js'
import type { ToolPermissionContext } from './types/permissions.js'
import { createEmptyToolPermissionContext } from './types/permissions.js'
import { hasPermissionsToUseTool } from './utils/permissions/permissions.js'
import { query } from './query.js'
import type { QueryEvent, Terminal, QueryDeps } from './query/deps.js'

// ============================================================================
// QueryEngine
// ============================================================================

export interface QueryEngineOptions {
  provider: LLMProvider
  tools: Tools
  model: string
  maxTokens: number
  systemPrompt: string
  cwd: string
  maxTurns?: number
  debug?: boolean
  verbose?: boolean
  isNonInteractiveSession?: boolean
  permissionContext?: ToolPermissionContext
  requestPrompt?: ToolUseContext['requestPrompt']
  deps?: Partial<QueryDeps>
}

export class QueryEngine {
  private provider: LLMProvider
  private tools: Tools
  private model: string
  private maxTokens: number
  private systemPrompt: string
  private cwd: string
  private maxTurns: number
  private debug: boolean
  private verbose: boolean
  private isNonInteractiveSession: boolean
  private permissionContext: ToolPermissionContext
  private requestPrompt: ToolUseContext['requestPrompt']
  private deps: Partial<QueryDeps> | undefined

  // Conversation state
  private conversation: UnifiedMessage[] = []
  private cumulativeUsage: TokenUsage = emptyUsage()
  private abortController = new AbortController()

  // Application state (shared across tools)
  private appState: Record<string, unknown> = {}
  private readFileState = new Map<string, unknown>()
  private inProgressToolUseIDs = new Set<string>()
  private responseLength = 0

  constructor(options: QueryEngineOptions) {
    this.provider = options.provider
    this.tools = options.tools
    this.model = options.model
    this.maxTokens = options.maxTokens
    this.systemPrompt = options.systemPrompt
    this.cwd = options.cwd
    this.maxTurns = options.maxTurns ?? 100
    this.debug = options.debug ?? false
    this.verbose = options.verbose ?? false
    this.isNonInteractiveSession = options.isNonInteractiveSession ?? false
    this.permissionContext = options.permissionContext ?? createEmptyToolPermissionContext()
    this.requestPrompt = options.requestPrompt
    this.deps = options.deps
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Run a query with the given user input.
   * Returns an async generator of events.
   */
  async *run(userInput: string): AsyncGenerator<QueryEvent, Terminal, undefined> {
    // Add user message
    this.conversation.push({ role: 'user', content: userInput })

    // Store provider in app state so tools (AgentTool, WebSearchTool) can access it
    this.appState._provider = this.provider
    this.appState._permissionContext = this.permissionContext

    const toolUseContext = this.createToolUseContext()
    const canUseTool = this.createCanUseToolFn()

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
    })

    // Update conversation from final query state
    if (result.finalMessages) {
      this.conversation = [...result.finalMessages]
    }

    return result
  }

  /**
   * Run a query and collect all events into an array.
   * Convenience method for non-streaming use cases.
   */
  async runToCompletion(userInput: string): Promise<{
    events: QueryEvent[]
    terminal: Terminal
    assistantText: string
  }> {
    const events: QueryEvent[] = []
    let assistantText = ''

    const gen = this.run(userInput)
    let result = await gen.next()

    while (!result.done) {
      events.push(result.value)
      if (result.value.type === 'text_delta') {
        assistantText += result.value.text
      }
      result = await gen.next()
    }

    // Update conversation from final messages returned by query loop
    if (result.value.finalMessages) {
      this.conversation = [...result.value.finalMessages]
    }

    return {
      events,
      terminal: result.value,
      assistantText,
    }
  }

  /** Get the current conversation history */
  getConversation(): ReadonlyArray<UnifiedMessage> {
    return this.conversation
  }

  /** Add a message to the conversation (for external injection) */
  addMessage(message: UnifiedMessage): void {
    this.conversation.push(message)
  }

  /** Clear conversation history */
  clearConversation(): void {
    this.conversation = []
    this.readFileState.clear()
    this.inProgressToolUseIDs.clear()
    this.responseLength = 0
  }

  /** Update the system prompt */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
  }

  /** Update the permission context */
  setPermissionContext(context: ToolPermissionContext): void {
    this.permissionContext = context
  }

  /** Update tools (e.g., after MCP servers connect) */
  setTools(tools: Tools): void {
    this.tools = tools
  }

  /** Abort the current query */
  abort(): void {
    this.abortController.abort('user_abort')
    // Create a fresh controller for the next query
    this.abortController = new AbortController()
  }

  /** Get cumulative token usage */
  getUsage(): TokenUsage {
    return { ...this.cumulativeUsage }
  }

  // ========================================================================
  // Private methods
  // ========================================================================

  private createToolUseContext(): ToolUseContext {
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
        this.appState = f(this.appState)
      },
      readFileState: {
        has: (path: string) => this.readFileState.has(path),
        get: (path: string) => this.readFileState.get(path),
        set: (path: string, value: unknown) => this.readFileState.set(path, value),
      },
      setInProgressToolUseIDs: (f) => {
        this.inProgressToolUseIDs = f(this.inProgressToolUseIDs)
      },
      setResponseLength: (f) => {
        this.responseLength = f(this.responseLength)
      },
      requestPrompt: this.requestPrompt,
    }
  }

  private createCanUseToolFn(): CanUseToolFn {
    return async (tool, input, context, _assistantMessage, _toolUseID) => {
      const decision = await hasPermissionsToUseTool(
        {
          name: tool.name,
          mcpInfo: tool.mcpInfo,
          inputSchema: tool.inputSchema,
          checkPermissions: (parsedInput: unknown, ctx: unknown) =>
            tool.checkPermissions(parsedInput as Record<string, unknown>, ctx as ToolUseContext) as Promise<import('./types/permissions.js').PermissionResult>,
          requiresUserInteraction: tool.requiresUserInteraction,
        },
        input as Record<string, unknown>,
        this.permissionContext,
        context,
      )

      // Map PermissionDecision to the PermissionResult expected by CanUseToolFn
      return {
        behavior: decision.behavior === 'deny' ? 'deny' : decision.behavior === 'ask' ? 'ask' : 'allow',
        updatedInput: 'updatedInput' in decision ? decision.updatedInput : undefined,
        message: 'message' in decision ? decision.message : undefined,
      }
    }
  }
}
