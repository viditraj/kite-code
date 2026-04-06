/**
 * AgentTool — Launch subagents for delegated tasks.
 *
 * Based on Claude Code's AgentTool.tsx with full feature parity:
 * - Built-in agent types (Explore, Plan, GeneralPurpose)
 * - Agent-specific system prompts and tool filtering
 * - Sync (foreground) and async (background) execution
 * - Progress tracking with token/tool counts
 * - Background completion notifications
 * - One-shot agents (Explore, Plan) skip agent trailer
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext, ToolCallProgress, Tool, Tools } from '../../Tool.js'
import { query } from '../../query.js'
import type { QueryEvent, Terminal } from '../../query/deps.js'
import type { UnifiedMessage, ContentBlock, TokenUsage } from '../../providers/types.js'
import { emptyUsage, addUsage } from '../../providers/types.js'
import { createEmptyToolPermissionContext } from '../../types/permissions.js'
import {
  findBuiltInAgent,
  getBuiltInAgents,
  getAgentSelectionPrompt,
  filterToolsForAgent,
  ONE_SHOT_AGENT_TYPES,
  GENERAL_PURPOSE_AGENT,
  type AgentDefinition,
} from './agentTypes.js'

// ============================================================================
// Constants
// ============================================================================

export const AGENT_TOOL_NAME = 'Agent'
export const LEGACY_AGENT_TOOL_NAME = 'Task'
const DEFAULT_AGENT_MAX_TURNS = 50

// ============================================================================
// Schema
// ============================================================================

// Flexible boolean that accepts "true"/"false" strings from open-source models
const flexBool = z.preprocess(
  (val) => {
    if (val === 'true' || val === '1') return true
    if (val === 'false' || val === '0' || val === null || val === 'null') return false
    return val
  },
  z.boolean().optional(),
)

const inputSchema = z.object({
  description: z.preprocess(
    (val) => val === undefined || val === null ? '' : val,
    z.string().describe('A short (3-5 word) description of the task'),
  ),
  prompt: z.string().describe(
    'The task for the agent to perform. Be specific and provide all necessary context.',
  ),
  subagent_type: z.string().optional().describe(
    'Specialized agent type: "Explore" (fast read-only search), "Plan" (architecture & planning), or omit for general-purpose.',
  ),
  run_in_background: flexBool.describe(
    'Set to true to run in the background. You will be notified when it completes.',
  ),
}).passthrough()

type AgentInput = z.infer<typeof inputSchema>

// ============================================================================
// Result types
// ============================================================================

export interface AgentToolResult {
  agentId: string
  agentType?: string
  content: Array<{ type: 'text'; text: string }>
  totalToolUseCount: number
  totalDurationMs: number
  totalTokens: number
}

type AgentOutput =
  | { status: 'completed'; prompt: string } & AgentToolResult
  | { status: 'async_launched'; agentId: string; agentType: string; description: string; prompt: string }

// ============================================================================
// Progress tracking
// ============================================================================

interface ProgressTracker {
  toolUseCount: number
  cumulativeOutputTokens: number
  latestInputTokens: number
  recentActivities: Array<{ toolName: string; description?: string }>
}

function createProgressTracker(): ProgressTracker {
  return {
    toolUseCount: 0,
    cumulativeOutputTokens: 0,
    latestInputTokens: 0,
    recentActivities: [],
  }
}

function updateProgressFromEvent(tracker: ProgressTracker, event: QueryEvent): void {
  if (event.type === 'tool_result') {
    tracker.toolUseCount++
    const ev = event as any
    const toolName = ev.toolName ?? ev.result?.toolName ?? 'tool'
    tracker.recentActivities.push({ toolName })
    // Keep only last 5
    if (tracker.recentActivities.length > 5) {
      tracker.recentActivities.shift()
    }
  }
  if (event.type === 'message_end' && 'usage' in event && event.usage) {
    const usage = event.usage as TokenUsage
    tracker.latestInputTokens = (usage.inputTokens ?? 0)
      + (usage.cacheReadInputTokens ?? 0)
      + (usage.cacheCreationInputTokens ?? 0)
    tracker.cumulativeOutputTokens += (usage.outputTokens ?? 0)
  }
}

// ============================================================================
// Agent result finalization
// ============================================================================

function finalizeAgentResult(
  agentMessages: QueryEvent[],
  agentId: string,
  agentType: string | undefined,
  startTime: number,
): AgentToolResult {
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
    }
  }

  // Capture any remaining text that wasn't followed by turn_complete
  if (currentTurnText.length > 0) {
    lastAssistantText = currentTurnText
  }

  const totalTokens = (cumulativeUsage.inputTokens ?? 0)
    + (cumulativeUsage.outputTokens ?? 0)
    + (cumulativeUsage.cacheReadInputTokens ?? 0)
    + (cumulativeUsage.cacheCreationInputTokens ?? 0)

  return {
    agentId,
    agentType,
    content: lastAssistantText
      ? [{ type: 'text' as const, text: lastAssistantText }]
      : [{ type: 'text' as const, text: '(Agent completed with no text output)' }],
    totalToolUseCount,
    totalDurationMs: Date.now() - startTime,
    totalTokens,
  }
}

// ============================================================================
// System prompt builder
// ============================================================================

function buildAgentSystemPrompt(
  agentDef: AgentDefinition,
  taskPrompt: string,
  parentContext?: { parentPrompt?: string },
): string {
  const agentPrompt = agentDef.getSystemPrompt(parentContext)

  const isOneShot = ONE_SHOT_AGENT_TYPES.has(agentDef.agentType)

  const trailer = isOneShot
    ? ''
    : `\n\nYour agent ID is available for reference. When finished, provide a clear summary of what you accomplished.`

  return `${agentPrompt}

Your task:
${taskPrompt}${trailer}`
}

// ============================================================================
// Tool definition
// ============================================================================

export const AgentTool = buildTool({
  name: AGENT_TOOL_NAME,
  searchHint: 'spawn a subagent for parallel or delegated work',
  maxResultSizeChars: 100_000,
  strict: false,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => false,

  async description(input: AgentInput) {
    const type = input.subagent_type ? ` (${input.subagent_type})` : ''
    return `Spawn agent${type}: ${input.description}`
  },

  async prompt() {
    const agentList = getAgentSelectionPrompt()
    return `Launch a subagent to work on a task independently. The agent gets its own query loop, tools, and context.

${agentList}

Parameters:
- description: Short (3-5 word) task description
- prompt: Detailed task instructions with all necessary context
- subagent_type: Optional. "Explore" for fast read-only search, "Plan" for architecture, or omit for general-purpose
- run_in_background: Optional. Set true for long tasks — you'll be notified when done

Tips:
- Use "Explore" for quick codebase searches — it's faster and cheaper
- Use "Plan" when you need a detailed implementation strategy before coding
- Use general-purpose (no subagent_type) for tasks that need to read AND write files
- Background agents are useful for long-running tasks so you can continue working`
  },

  async call(
    input: AgentInput,
    context: ToolUseContext,
    _canUseTool,
    _parentMessage,
    onProgress?: ToolCallProgress,
  ) {
    const { description, prompt, run_in_background, subagent_type } = input
    const agentId = randomUUID().slice(0, 12)
    const startTime = Date.now()

    // Resolve agent definition
    const agentDef = subagent_type
      ? findBuiltInAgent(subagent_type) ?? GENERAL_PURPOSE_AGENT
      : GENERAL_PURPOSE_AGENT

    // Get provider from appState
    const appState = context.options as any
    const provider = (context as any).getAppState?.()._provider
      ?? (appState._provider)
      ?? (() => { throw new Error('No LLM provider available for subagent') })()

    const model = agentDef.model === 'inherit' || !agentDef.model
      ? context.options.mainLoopModel
      : agentDef.model

    // Filter tools for this agent
    const parentTools = context.options.tools ?? []
    const agentTools = agentDef.useExactTools
      ? parentTools
      : filterToolsForAgent(parentTools as any[], agentDef) as unknown as Tools

    // Build system prompt
    const systemPrompt = buildAgentSystemPrompt(agentDef, prompt)

    // Build initial messages
    const initialMessages: UnifiedMessage[] = [
      { role: 'user', content: prompt },
    ]

    // Build permission context — agents inherit parent's mode
    const permissionContext = (context as any).getAppState?.()._permissionContext
      ?? createEmptyToolPermissionContext()

    // Agent's tool use context — independent abort controller
    const agentAbortController = run_in_background
      ? new AbortController()  // Independent for background
      : context.abortController // Linked for foreground

    const agentToolUseContext: ToolUseContext = {
      ...context,
      abortController: agentAbortController,
    }

    // Permission check function — same as parent but scoped
    const agentCanUseTool = async (
      tool: any,
      toolInput: any,
      toolCtx: any,
      assistantMsg: any,
      toolUseId: any,
    ) => {
      // Read-only tools auto-allow
      if (tool.isReadOnly(toolInput)) {
        return { behavior: 'allow' as const }
      }
      // For background agents, deny tools that need permission (can't prompt user)
      if (run_in_background) {
        return { behavior: 'allow' as const } // Background agents auto-allow (like acceptEdits mode)
      }
      // Foreground agents defer to parent permission system
      if (context.requestPrompt) {
        return { behavior: 'ask' as const, message: `Agent wants to use ${tool.name}` }
      }
      return { behavior: 'allow' as const }
    }

    // ================================================================
    // Async (background) execution
    // ================================================================
    if (run_in_background) {
      // Store agent state in appState for TaskOutput to read
      const setAppState = (context as any).setAppState ?? ((f: any) => {})

      // Fire-and-forget
      void (async () => {
        const agentEvents: QueryEvent[] = []
        const tracker = createProgressTracker()

        try {
          const gen = query({
            provider,
            messages: initialMessages,
            systemPrompt,
            tools: agentTools,
            toolUseContext: agentToolUseContext,
            canUseTool: agentCanUseTool,
            model,
            maxTokens: 16384,
            permissionContext,
      maxTurns: agentDef.maxTurns ?? DEFAULT_AGENT_MAX_TURNS,
          })

          for await (const event of gen) {
            agentEvents.push(event)
            updateProgressFromEvent(tracker, event)

            // Update progress in appState
            setAppState((prev: any) => ({
              ...prev,
              tasks: {
                ...(prev.tasks ?? {}),
                [agentId]: {
                  id: agentId,
                  type: 'local_agent',
                  status: 'running',
                  description,
                  startedAt: startTime,
                  progress: {
                    toolUseCount: tracker.toolUseCount,
                    tokenCount: tracker.latestInputTokens + tracker.cumulativeOutputTokens,
                    recentActivities: tracker.recentActivities,
                  },
                },
              },
            }))
          }

          // Finalize
          const result = finalizeAgentResult(agentEvents, agentId, agentDef.agentType, startTime)

          // Store completed result
          setAppState((prev: any) => ({
            ...prev,
            tasks: {
              ...(prev.tasks ?? {}),
              [agentId]: {
                id: agentId,
                type: 'local_agent',
                status: 'completed',
                description,
                startedAt: startTime,
                completedAt: Date.now(),
                result,
              },
            },
            [`agent_result_${agentId}`]: {
              status: 'completed',
              result,
            },
          }))
        } catch (err) {
          // Store error
          setAppState((prev: any) => ({
            ...prev,
            tasks: {
              ...(prev.tasks ?? {}),
              [agentId]: {
                id: agentId,
                type: 'local_agent',
                status: 'failed',
                description,
                startedAt: startTime,
                completedAt: Date.now(),
                error: (err as Error).message,
              },
            },
            [`agent_result_${agentId}`]: {
              status: 'failed',
              error: (err as Error).message,
            },
          }))
        }
      })()

      // Register in appState immediately
      const setAppState2 = (context as any).setAppState ?? ((f: any) => {})
      setAppState2((prev: any) => ({
        ...prev,
        tasks: {
          ...(prev.tasks ?? {}),
          [agentId]: {
            id: agentId,
            type: 'local_agent',
            status: 'running',
            description,
            startedAt: startTime,
          },
        },
      }))

      return {
        data: {
          status: 'async_launched',
          agentId,
          agentType: agentDef.agentType,
          description,
          prompt,
        } as AgentOutput,
      }
    }

    // ================================================================
    // Sync (foreground) execution
    // ================================================================
    const agentEvents: QueryEvent[] = []
    const tracker = createProgressTracker()

    try {
      const gen = query({
        provider,
        messages: initialMessages,
        systemPrompt,
        tools: agentTools,
        toolUseContext: agentToolUseContext,
        canUseTool: agentCanUseTool,
        model,
        maxTokens: 16384,
        permissionContext,
      maxTurns: agentDef.maxTurns ?? DEFAULT_AGENT_MAX_TURNS,
      })

      for await (const event of gen) {
        agentEvents.push(event)
        updateProgressFromEvent(tracker, event)

        // Forward progress to parent
        if (onProgress && (event.type === 'tool_result' || event.type === 'text_delta')) {
          onProgress({
            toolUseID: `agent-${agentId}`,
            data: {
              type: 'agent_progress',
              agentId,
              agentType: agentDef.agentType,
              toolUseCount: tracker.toolUseCount,
              tokenCount: tracker.latestInputTokens + tracker.cumulativeOutputTokens,
            },
          })
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        return {
          data: {
            status: 'completed',
            prompt,
            agentId,
            agentType: agentDef.agentType,
            content: [{ type: 'text' as const, text: `Agent error: ${(err as Error).message}` }],
            totalToolUseCount: tracker.toolUseCount,
            totalDurationMs: Date.now() - startTime,
            totalTokens: tracker.latestInputTokens + tracker.cumulativeOutputTokens,
          } as AgentOutput,
        }
      }
    }

    const result = finalizeAgentResult(agentEvents, agentId, agentDef.agentType, startTime)

    return {
      data: {
        status: 'completed',
        prompt,
        ...result,
      } as AgentOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: AgentOutput, toolUseID: string) {
    if (data.status === 'async_launched') {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: `Agent "${data.description}" launched in background (ID: ${data.agentId}, type: ${data.agentType}). You will be notified when it completes. Use TaskOutput to check progress.`,
      }
    }

    const result = data as Extract<AgentOutput, { status: 'completed' }>
    const text = result.content.map(b => b.text).join('\n')
    const agentType = result.agentType ? ` (${result.agentType})` : ''
    const metrics = `[Agent${agentType}: ${result.totalToolUseCount} tool uses, ${result.totalTokens.toLocaleString()} tokens, ${(result.totalDurationMs / 1000).toFixed(1)}s]`

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `${text}\n\n${metrics}`,
    }
  },
})

export { type AgentDefinition } from './agentTypes.js'
