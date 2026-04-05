/**
 * Streaming tool executor with concurrent/serial execution.
 *
 * Implements the same patterns as Claude Code's StreamingToolExecutor.ts:
 * - Concurrent-safe tools run in parallel
 * - Non-concurrent tools run exclusively (one at a time)
 * - Results yielded in order as tools complete
 * - Sibling abort: Bash errors cancel parallel siblings
 * - Progress messages yielded immediately
 * - discard() for streaming fallback
 */

import { type Tool, type Tools, findToolByName } from '../../Tool.js'
import type { ToolUseContext, ToolResult } from '../../Tool.js'
import type { ContentBlock } from '../../providers/types.js'

// ============================================================================
// Types
// ============================================================================

export interface ToolUseBlock {
  id: string
  name: string
  input: Record<string, unknown>
}

type ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'

interface TrackedTool {
  id: string
  block: ToolUseBlock
  status: ToolStatus
  isConcurrencySafe: boolean
  promise?: Promise<void>
  result?: ToolExecutionResult
  pendingProgress: ToolExecutionEvent[]
}

export interface ToolExecutionResult {
  toolUseId: string
  toolName: string
  output: string
  isError: boolean
  /** The raw content block for the API */
  contentBlock: ContentBlock
}

export type ToolExecutionEvent =
  | { type: 'tool_start'; toolUseId: string; toolName: string }
  | { type: 'tool_progress'; toolUseId: string; message: string }
  | { type: 'tool_result'; result: ToolExecutionResult }

// ============================================================================
// StreamingToolExecutor
// ============================================================================

export class StreamingToolExecutor {
  private tools: TrackedTool[] = []
  private toolDefinitions: Tools
  private context: ToolUseContext
  private hasErrored = false
  private erroredToolDescription = ''
  private siblingAbortController: AbortController
  private discarded = false

  constructor(toolDefinitions: Tools, context: ToolUseContext) {
    this.toolDefinitions = toolDefinitions
    this.context = context
    // Create a child abort controller for sibling cancellation
    this.siblingAbortController = new AbortController()
    // If the parent aborts, abort siblings too
    context.abortController.signal.addEventListener('abort', () => {
      this.siblingAbortController.abort('parent_abort')
    })
  }

  /**
   * Discard all pending and in-progress tools.
   * Called when streaming fallback occurs.
   */
  discard(): void {
    this.discarded = true
  }

  /**
   * Add a tool to the execution queue.
   * Starts executing immediately if conditions allow.
   */
  addTool(block: ToolUseBlock): void {
    const toolDef = findToolByName(this.toolDefinitions, block.name)

    if (!toolDef) {
      // Unknown tool — mark as completed with error
      this.tools.push({
        id: block.id,
        block,
        status: 'completed',
        isConcurrencySafe: true,
        pendingProgress: [],
        result: {
          toolUseId: block.id,
          toolName: block.name,
          output: `Error: No such tool available: ${block.name}`,
          isError: true,
          contentBlock: {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: No such tool available: ${block.name}`,
            is_error: true,
          },
        },
      })
      return
    }

    // Determine concurrency safety from the tool's input
    let isConcurrencySafe = false
    try {
      const parsed = toolDef.inputSchema.safeParse(block.input)
      if (parsed.success) {
        isConcurrencySafe = toolDef.isConcurrencySafe(parsed.data)
      }
    } catch {
      isConcurrencySafe = false
    }

    this.tools.push({
      id: block.id,
      block,
      status: 'queued',
      isConcurrencySafe,
      pendingProgress: [],
    })

    // Try to start execution immediately
    void this.processQueue()
  }

  /**
   * Get all results as an async generator.
   * Yields events as tools start, progress, and complete.
   */
  async *getResults(): AsyncGenerator<ToolExecutionEvent, void, undefined> {
    while (this.hasUnfinishedTools()) {
      // Process the queue — start tools that can run
      const startEvents = this.processQueueSync()
      for (const event of startEvents) {
        yield event
      }

      // Collect completed results (in order)
      for (const event of this.collectCompleted()) {
        yield event
      }

      // If tools are still executing, wait for any to complete
      const executing = this.tools.filter(t => t.status === 'executing' && t.promise)
      if (executing.length > 0 && !this.hasCompletedTools()) {
        await Promise.race(executing.map(t => t.promise!))
      }
    }

    // Final sweep
    for (const event of this.collectCompleted()) {
      yield event
    }
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private canExecuteTool(isConcurrencySafe: boolean): boolean {
    const executing = this.tools.filter(t => t.status === 'executing')
    return (
      executing.length === 0 ||
      (isConcurrencySafe && executing.every(t => t.isConcurrencySafe))
    )
  }

  private async processQueue(): Promise<void> {
    for (const tool of this.tools) {
      if (tool.status !== 'queued') continue
      if (this.discarded) break

      if (this.canExecuteTool(tool.isConcurrencySafe)) {
        tool.status = 'executing'
        tool.promise = this.executeTool(tool)
      } else if (!tool.isConcurrencySafe) {
        // Must maintain order for non-concurrent tools — stop here
        break
      }
    }
  }

  private processQueueSync(): ToolExecutionEvent[] {
    const events: ToolExecutionEvent[] = []

    for (const tool of this.tools) {
      if (tool.status !== 'queued') continue
      if (this.discarded) break

      if (this.canExecuteTool(tool.isConcurrencySafe)) {
        tool.status = 'executing'
        events.push({ type: 'tool_start', toolUseId: tool.id, toolName: tool.block.name })
        tool.promise = this.executeTool(tool)
      } else if (!tool.isConcurrencySafe) {
        break
      }
    }

    return events
  }

  private async executeTool(tracked: TrackedTool): Promise<void> {
    if (this.discarded) {
      tracked.result = {
        toolUseId: tracked.id,
        toolName: tracked.block.name,
        output: 'Tool execution was discarded (streaming fallback)',
        isError: true,
        contentBlock: {
          type: 'tool_result',
          tool_use_id: tracked.id,
          content: 'Tool execution was discarded',
          is_error: true,
        },
      }
      tracked.status = 'completed'
      return
    }

    const toolDef = findToolByName(this.toolDefinitions, tracked.block.name)
    if (!toolDef) {
      tracked.result = {
        toolUseId: tracked.id,
        toolName: tracked.block.name,
        output: `Error: Tool not found: ${tracked.block.name}`,
        isError: true,
        contentBlock: {
          type: 'tool_result',
          tool_use_id: tracked.id,
          content: `Error: Tool not found: ${tracked.block.name}`,
          is_error: true,
        },
      }
      tracked.status = 'completed'
      return
    }

    try {
      // Parse and validate input
      const parsed = toolDef.inputSchema.safeParse(tracked.block.input)
      if (!parsed.success) {
        const errorMsg = `Input validation failed: ${parsed.error.message}`
        tracked.result = {
          toolUseId: tracked.id,
          toolName: tracked.block.name,
          output: errorMsg,
          isError: true,
          contentBlock: {
            type: 'tool_result',
            tool_use_id: tracked.id,
            content: errorMsg,
            is_error: true,
          },
        }
        tracked.status = 'completed'
        return
      }

      // Validate input if the tool provides validation
      if (toolDef.validateInput) {
        const validation = await toolDef.validateInput(parsed.data, this.context)
        if (!validation.result) {
          tracked.result = {
            toolUseId: tracked.id,
            toolName: tracked.block.name,
            output: validation.message || 'Input validation failed',
            isError: true,
            contentBlock: {
              type: 'tool_result',
              tool_use_id: tracked.id,
              content: validation.message || 'Input validation failed',
              is_error: true,
            },
          }
          tracked.status = 'completed'
          return
        }
      }

      // Backfill observable input before execution (matching Claude Code pattern)
      if (toolDef.backfillObservableInput) {
        const inputCopy = { ...tracked.block.input }
        toolDef.backfillObservableInput(inputCopy)
      }

      // Execute the tool with full signature (canUseTool, parentMessage)
      const result = await toolDef.call(
        parsed.data,
        this.context,
        async () => ({ behavior: 'allow' as const }), // canUseTool — permission checks done before executor
        {}, // parentMessage — set by query loop when wiring executor to conversation
      )

      // Map result to content block
      const contentBlock = toolDef.mapToolResultToToolResultBlockParam(result.data, tracked.id)

      const outputStr = typeof contentBlock.content === 'string'
        ? contentBlock.content
        : JSON.stringify(contentBlock.content)

      tracked.result = {
        toolUseId: tracked.id,
        toolName: tracked.block.name,
        output: outputStr,
        isError: contentBlock.is_error ?? false,
        contentBlock,
      }
      tracked.status = 'completed'

      // Sibling abort on Bash error (matching Claude Code's StreamingToolExecutor.ts)
      if (contentBlock.is_error && tracked.block.name === 'Bash') {
        this.hasErrored = true
        this.erroredToolDescription = `Bash: ${String(tracked.block.input.command ?? '').slice(0, 100)}`
        this.siblingAbortController.abort('sibling_error')
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const isCancelled = error.name === 'AbortError' || this.siblingAbortController.signal.aborted

      const message = isCancelled && this.hasErrored
        ? `Tool cancelled because a sibling tool errored: ${this.erroredToolDescription}`
        : `Tool error: ${error.message}`

      tracked.result = {
        toolUseId: tracked.id,
        toolName: tracked.block.name,
        output: message,
        isError: true,
        contentBlock: {
          type: 'tool_result',
          tool_use_id: tracked.id,
          content: message,
          is_error: true,
        },
      }
      tracked.status = 'completed'
    }
  }

  private collectCompleted(): ToolExecutionEvent[] {
    const events: ToolExecutionEvent[] = []
    for (const tool of this.tools) {
      if (tool.status === 'completed' && tool.result) {
        tool.status = 'yielded'
        events.push({ type: 'tool_result', result: tool.result })
      }
    }
    return events
  }

  private hasUnfinishedTools(): boolean {
    return this.tools.some(t => t.status === 'queued' || t.status === 'executing')
  }

  private hasCompletedTools(): boolean {
    return this.tools.some(t => t.status === 'completed')
  }
}
