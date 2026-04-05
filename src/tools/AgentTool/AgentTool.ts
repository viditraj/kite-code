/**
 * AgentTool — Launch subagent for delegated tasks.
 *
 * Implements the same patterns as Claude Code's AgentTool:
 * - Spawn a subagent with its own query loop via the query() async generator
 * - Sync (foreground) execution drives the query loop directly
 * - Async (background) execution fires and forgets with notification on completion
 * - Result finalization extracts last assistant text + metrics
 * - Progress forwarding from nested tool execution
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext, ToolCallProgress, Tool, Tools } from '../../Tool.js'
import { query } from '../../query.js'
import type { QueryEvent, Terminal } from '../../query/deps.js'
import { createDefaultDeps } from '../../query/deps.js'
import type { UnifiedMessage, ContentBlock, TokenUsage } from '../../providers/types.js'
import { emptyUsage, addUsage } from '../../providers/types.js'
import { toolsToSchemas } from '../../tools.js'
import { createEmptyToolPermissionContext } from '../../types/permissions.js'

// ============================================================================
// Constants
// ============================================================================

export const AGENT_TOOL_NAME = 'Agent'
export const LEGACY_AGENT_TOOL_NAME = 'Task'
const DEFAULT_AGENT_MAX_TURNS = 30

// ============================================================================
// Schema
// ============================================================================

const inputSchema = z.strictObject({
  description: z.string().describe(
    'A short (3-5 word) description of the task',
  ),
  prompt: z.string().describe(
    'The task for the agent to perform. Be specific and provide all necessary context.',
  ),
  run_in_background: z.boolean().optional().describe(
    'Set to true to run this agent in the background. The agent will execute independently and you will be notified when it completes.',
  ),
})

type AgentInput = z.infer<typeof inputSchema>

export interface AgentToolResult {
  agentId: string
  content: Array<{ type: 'text'; text: string }>
  totalToolUseCount: number
  totalDurationMs: number
  totalTokens: number
}

type AgentOutput =
  | { status: 'completed'; prompt: string } & AgentToolResult
  | { status: 'async_launched'; agentId: string; description: string; prompt: string }

// ============================================================================
// Agent result finalization — extracts text content and metrics from messages
// ============================================================================

function finalizeAgentResult(
  agentMessages: QueryEvent[],
  agentId: string,
  startTime: number,
): AgentToolResult {
  // Extract text content from text_delta events
  let lastAssistantText = ''
  let currentTurnText = ''
  let totalToolUseCount = 0
  let cumulativeUsage: TokenUsage = emptyUsage()

  for (const event of agentMessages) {
    switch (event.type) {
      case 'text_delta':
        currentTurnText += event.text
        break
      case 'turn_complete':
        if (currentTurnText.length > 0) {
          lastAssistantText = currentTurnText
        }
        currentTurnText = ''
        break
      case 'tool_result':
        totalToolUseCount++
        break
      case 'message_end':
        if ('usage' in event && event.usage) {
          cumulativeUsage = addUsage(cumulativeUsage, event.usage)
        }
        break
      case 'message_start':
        if ('usage' in event && event.usage) {
          cumulativeUsage = addUsage(cumulativeUsage, event.usage)
        }
        break
    }
  }

  // If we never got a turn_complete but have accumulated text, use it
  if (lastAssistantText.length === 0 && currentTurnText.length > 0) {
    lastAssistantText = currentTurnText
  }

  const content: Array<{ type: 'text'; text: string }> = lastAssistantText.length > 0
    ? [{ type: 'text', text: lastAssistantText }]
    : []

  return {
    agentId,
    content,
    totalToolUseCount,
    totalDurationMs: Date.now() - startTime,
    totalTokens: cumulativeUsage.inputTokens + cumulativeUsage.outputTokens,
  }
}

// ============================================================================
// Build agent system prompt
// ============================================================================

function buildAgentSystemPrompt(parentPrompt: string, agentPrompt: string): string {
  return `You are a subagent working on a specific task. Focus exclusively on the task described below.

Your task:
${agentPrompt}

Guidelines:
- Complete the task thoroughly and report your findings
- Use the tools available to you as needed
- Be concise but complete in your response
- Do not ask the user questions — work independently with the information provided
- When finished, provide a clear summary of what you accomplished`
}

// ============================================================================
// Tool definition
// ============================================================================

export const AgentTool = buildTool({
  name: AGENT_TOOL_NAME,
  aliases: [LEGACY_AGENT_TOOL_NAME, 'Task'],
  searchHint: 'delegate work to a subagent',
  maxResultSizeChars: 100_000,
  strict: true,

  inputSchema,

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async description() {
    return 'Launch a new agent to handle a task'
  },

  async prompt() {
    return `Launch a new agent that can work independently on a task. The agent has access to the same tools as you.

Use this tool when:
- You need to delegate a self-contained task
- The task can be done in parallel with your current work
- You want to break down complex work into independent subtasks

The agent will:
1. Receive the prompt you provide as its task
2. Work independently using available tools
3. Return its results when complete

Parameters:
- description: A brief 3-5 word summary (e.g., "Fix login bug", "Add unit tests")
- prompt: Detailed instructions. Include ALL context the agent needs — file paths, function names, requirements. The agent cannot see your conversation history.
- run_in_background: Set true for tasks that don't need immediate results

Tips:
- Be specific in the prompt — the agent has no context beyond what you provide
- For background agents, you'll be notified when they complete
- Don't spawn agents for trivial tasks you can do directly`
  },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call(
    { description, prompt, run_in_background },
    context: ToolUseContext,
    _canUseTool,
    _parentMessage,
    onProgress?: ToolCallProgress,
  ) {
    const agentId = randomUUID()
    const startTime = Date.now()

    // Build agent context: child abort controller, own tools
    const agentAbortController = new AbortController()
    // If parent aborts, abort the child too
    context.abortController.signal.addEventListener('abort', () => {
      agentAbortController.abort('parent_abort')
    }, { once: true })

    const agentToolUseContext: ToolUseContext = {
      ...context,
      abortController: agentAbortController,
      agentId,
      messages: [],
    }

    // Build system prompt for the subagent
    const systemPrompt = buildAgentSystemPrompt('', prompt)

    // Initial messages: user prompt
    const initialMessages: UnifiedMessage[] = [
      { role: 'user', content: prompt },
    ]

    // Get the provider from app state (stored during QueryEngine.run)
    const appState = context.getAppState()
    const provider = appState._provider as import('../../providers/types.js').LLMProvider | undefined
    const model = context.options.mainLoopModel
    const permissionContext = (appState._permissionContext ?? createEmptyToolPermissionContext()) as import('../../types/permissions.js').ToolPermissionContext

    if (!provider) {
      // No provider available — return error
      return {
        data: {
          status: 'completed' as const,
          prompt,
          agentId,
          content: [{ type: 'text' as const, text: 'Error: No LLM provider available for subagent execution. The AgentTool requires a provider to be set in app state.' }],
          totalToolUseCount: 0,
          totalDurationMs: Date.now() - startTime,
          totalTokens: 0,
        },
      }
    }

    // Create the canUseTool function for the subagent (auto-allow since parent approved)
    const agentCanUseTool = async () => ({ behavior: 'allow' as const })

    if (run_in_background) {
      // Async agent — fire and forget, drive query loop in background
      void (async () => {
        try {
          const gen = query({
            provider,
            messages: initialMessages,
            systemPrompt,
            tools: context.options.tools,
            toolUseContext: agentToolUseContext,
            canUseTool: agentCanUseTool,
            permissionContext,
            model,
            maxTokens: 16384,
            maxTurns: DEFAULT_AGENT_MAX_TURNS,
          })

          // Drive the generator to completion
          let result = await gen.next()
          while (!result.done) {
            result = await gen.next()
          }

          // Store result in app state for TaskOutput to read
          context.setAppState(prev => ({
            ...prev,
            [`agent_result_${agentId}`]: {
              status: 'completed',
              terminal: result.value,
            },
          }))
        } catch (err) {
          context.setAppState(prev => ({
            ...prev,
            [`agent_result_${agentId}`]: {
              status: 'failed',
              error: (err as Error).message,
            },
          }))
        }
      })()

      return {
        data: {
          status: 'async_launched' as const,
          agentId,
          description,
          prompt,
        },
      }
    }

    // Sync agent — drive the query loop and collect all events
    const agentEvents: QueryEvent[] = []

    try {
      const gen = query({
        provider,
        messages: initialMessages,
        systemPrompt,
        tools: context.options.tools,
        toolUseContext: agentToolUseContext,
        canUseTool: agentCanUseTool,
        permissionContext,
        model,
        maxTokens: 16384,
        maxTurns: DEFAULT_AGENT_MAX_TURNS,
      })

      let result = await gen.next()
      while (!result.done) {
        const event = result.value
        agentEvents.push(event)

        // Forward progress events to parent
        if (onProgress && 'toolUseId' in event) {
          onProgress({
            toolUseID: `agent_${agentId}`,
            data: { type: 'agent_progress', event },
          })
        }

        result = await gen.next()
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw err
      }
      // Agent errored — return partial result
      const partialResult = finalizeAgentResult(agentEvents, agentId, startTime)
      return {
        data: {
          status: 'completed' as const,
          prompt,
          ...partialResult,
          content: partialResult.content.length > 0
            ? partialResult.content
            : [{ type: 'text' as const, text: `Agent error: ${(err as Error).message}` }],
        },
      }
    }

    // Finalize: extract last text content + metrics
    const agentResult = finalizeAgentResult(agentEvents, agentId, startTime)

    return {
      data: {
        status: 'completed' as const,
        prompt,
        ...agentResult,
      },
    }
  },

  mapToolResultToToolResultBlockParam(data: AgentOutput, toolUseID: string) {
    if (data.status === 'async_launched') {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: `Async agent launched successfully.\nagentId: ${data.agentId}\nThe agent is working in the background. You will be notified automatically when it completes.\nBriefly tell the user what you launched and end your response.`,
      }
    }

    const contentOrMarker = data.content.length > 0
      ? data.content.map(b => b.text).join('\n')
      : '(Subagent completed but returned no output.)'

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `${contentOrMarker}\n\nagentId: ${data.agentId}\n<usage>total_tokens: ${data.totalTokens}\ntool_uses: ${data.totalToolUseCount}\nduration_ms: ${data.totalDurationMs}</usage>`,
    }
  },
})
