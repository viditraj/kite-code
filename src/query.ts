/**
 * Main query loop — the core agent loop.
 *
 * Implements the same pattern as Claude Code's query.ts:
 * - Infinite while(true) with explicit return/continue sites
 * - Streaming from provider with tool_use accumulation
 * - Permission-gated tool execution via StreamingToolExecutor
 * - Recovery paths: max_output_tokens, reactive compact, next_turn
 * - Abort/cancellation via AbortController
 * - Token budget tracking
 * - Auto-compaction
 *
 * Yields QueryEvent objects that the REPL/UI consumes for display.
 */

import type {
  StreamEvent,
  UnifiedMessage,
  ContentBlock,
  TokenUsage,
  StopReason,
} from './providers/types.js'
import { emptyUsage, addUsage } from './providers/types.js'
import type { Tool, Tools, ToolUseContext, CanUseToolFn } from './Tool.js'
import { findToolByName, toolMatchesName } from './Tool.js'
import { toolsToSchemas } from './tools.js'
import {
  StreamingToolExecutor,
  type ToolUseBlock,
  type ToolExecutionResult,
  type ToolExecutionEvent,
} from './services/tools/StreamingToolExecutor.js'
import type {
  QueryParams,
  QueryState,
  QueryEvent,
  Terminal,
  Continue,
  QueryDeps,
} from './query/deps.js'
import { createDefaultDeps } from './query/deps.js'
import { autoCompact as doAutoCompact } from './services/compact/autoCompact.js'
import { calculateTokenWarningState, type AutoCompactTrackingState } from './services/compact/autoCompact.js'
import { estimateTokenCount } from './query/tokenBudget.js'

// ============================================================================
// Constants
// ============================================================================

/** Default max turns if not specified */
const DEFAULT_MAX_TURNS = 100

/** Max output-tokens recovery attempts before giving up */
const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

/** Recovery message injected when output tokens are exhausted */
const OUTPUT_TOKENS_RECOVERY_MESSAGE =
  'Output token limit reached. Continue exactly where you left off. Do not repeat previous output or apologize.'

// ============================================================================
// query() — main entry point
// ============================================================================

/**
 * Main query async generator.
 *
 * Yields QueryEvent objects as the agent loop progresses.
 * Returns a Terminal value when the loop ends.
 */
export async function* query(
  params: QueryParams,
): AsyncGenerator<QueryEvent, Terminal, undefined> {
  const deps: QueryDeps = {
    ...createDefaultDeps(),
    ...params.deps,
  }

  const maxTurns = params.maxTurns ?? DEFAULT_MAX_TURNS

  // Initialize mutable state
  const state: QueryState = {
    messages: [...params.messages],
    toolUseContext: params.toolUseContext,
    turnCount: 0,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    maxOutputTokensOverride: params.maxOutputTokensOverride,
    transition: undefined,
    cumulativeUsage: emptyUsage(),
  }

  let autoCompactTracking: AutoCompactTrackingState | undefined

  // ========================================================================
  // Main loop
  // ========================================================================

  while (true) {
    const {
      messages: currentMessages,
      toolUseContext,
      turnCount,
      maxOutputTokensRecoveryCount,
      maxOutputTokensOverride,
    } = state

    // ------------------------------------------------------------------
    // Check max turns
    // ------------------------------------------------------------------
    if (turnCount >= maxTurns) {
      yield {
        type: 'max_turns_reached',
        maxTurns,
        turnCount,
      } as QueryEvent
      return { reason: 'max_turns', turnCount, finalMessages: state.messages }
    }

    yield { type: 'turn_start', turnCount } as QueryEvent

    // ------------------------------------------------------------------
    // Step 1: Auto-compact if needed
    // ------------------------------------------------------------------
    let messagesForQuery = currentMessages

    const estimatedTokens = estimateTokenCount(messagesForQuery)
    const { isAtBlockingLimit, isNearLimit } = calculateTokenWarningState(
      estimatedTokens,
      params.model,
    )

    if (isAtBlockingLimit) {
      return { reason: 'blocking_limit', finalMessages: state.messages }
    }

    if (isNearLimit && !state.hasAttemptedReactiveCompact) {
      try {
        const compactResult = await doAutoCompact(
          messagesForQuery,
          params.model,
          params.provider,
          autoCompactTracking,
        )
        if (compactResult.compacted) {
          messagesForQuery = compactResult.messages
          autoCompactTracking = compactResult.tracking
          yield {
            type: 'compact',
            reason: 'auto',
            messagesBefore: currentMessages.length,
            messagesAfter: messagesForQuery.length,
          } as QueryEvent
        }
      } catch {
        // Compaction failed — continue with original messages
      }
    }

    // ------------------------------------------------------------------
    // Step 2: Call the LLM
    // ------------------------------------------------------------------
    const toolSchemas = toolsToSchemas(params.tools)
    const maxTokens = maxOutputTokensOverride ?? params.maxTokens

    const assistantContent: ContentBlock[] = []
    const toolUseBlocks: ToolUseBlock[] = []
    let stopReason: StopReason = 'end_turn'
    let turnUsage: TokenUsage = emptyUsage()

    // Active tool_use accumulation
    let activeToolUse: { id: string; name: string; inputJson: string } | null = null

    try {
      const stream = deps.callModel(params.provider, {
        model: params.model,
        messages: messagesForQuery,
        system: params.systemPrompt,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        maxTokens,
        stream: true,
      })

      for await (const event of stream) {
        // Check abort
        if (toolUseContext.abortController.signal.aborted) {
          // Yield missing tool_results for orphaned tool_uses
          for (const tb of toolUseBlocks) {
            yield {
              type: 'tool_result',
              toolUseId: tb.id,
              toolName: tb.name,
              output: 'Interrupted by user',
              isError: true,
            } as QueryEvent
          }
          return { reason: 'aborted_streaming', finalMessages: state.messages }
        }

        // Forward provider events to consumer
        yield event

        // Accumulate content
        switch (event.type) {
          case 'text_delta':
            // Find or create a text block
            if (assistantContent.length === 0 || assistantContent.at(-1)?.type !== 'text') {
              assistantContent.push({ type: 'text', text: '' })
            }
            (assistantContent.at(-1) as { type: 'text'; text: string }).text += event.text
            break

          case 'thinking_delta':
            if (assistantContent.length === 0 || assistantContent.at(-1)?.type !== 'thinking') {
              assistantContent.push({ type: 'thinking', thinking: '' })
            }
            (assistantContent.at(-1) as { type: 'thinking'; thinking: string }).thinking += event.text
            break

          case 'tool_use_start':
            activeToolUse = { id: event.id, name: event.name, inputJson: '' }
            break

          case 'tool_use_delta':
            if (activeToolUse && activeToolUse.id === event.id) {
              activeToolUse.inputJson += event.inputDelta
            }
            break

          case 'tool_use_end':
            if (activeToolUse && activeToolUse.id === event.id) {
              let input: Record<string, unknown> = {}
              try {
                input = JSON.parse(activeToolUse.inputJson || '{}')
              } catch {
                input = {}
              }
              const block: ToolUseBlock = {
                id: activeToolUse.id,
                name: activeToolUse.name,
                input,
              }
              assistantContent.push({
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: block.input,
              })
              toolUseBlocks.push(block)
              activeToolUse = null
            }
            break

          case 'message_end':
            stopReason = event.stopReason
            if (event.usage) {
              turnUsage = addUsage(turnUsage, event.usage)
            }
            // Yield usage to the REPL for token tracking
            yield { type: 'message_end', stopReason, usage: turnUsage } as QueryEvent
            break

          case 'message_start':
            if (event.usage) {
              turnUsage = addUsage(turnUsage, event.usage)
            }
            break
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Check if this is an abort
      if (error.name === 'AbortError') {
        return { reason: 'aborted_streaming', finalMessages: state.messages }
      }

      yield { type: 'error', error, message: error.message, retrying: false }
      return { reason: 'model_error', error, finalMessages: state.messages }
    }

    // Update cumulative usage
    state.cumulativeUsage = addUsage(state.cumulativeUsage, turnUsage)

    // ------------------------------------------------------------------
    // Step 3: Build assistant message
    // ------------------------------------------------------------------
    const assistantMessage: UnifiedMessage = {
      role: 'assistant',
      content: assistantContent.length > 0 ? assistantContent : '',
    }

    // ------------------------------------------------------------------
    // Recovery: max_output_tokens
    // ------------------------------------------------------------------
    if (
      stopReason === 'max_tokens' &&
      toolUseBlocks.length === 0 &&
      maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT
    ) {
      yield {
        type: 'recovery',
        reason: 'max_output_tokens_recovery',
        detail: `attempt ${maxOutputTokensRecoveryCount + 1}/${MAX_OUTPUT_TOKENS_RECOVERY_LIMIT}`,
      } as QueryEvent

      const recoveryMessage: UnifiedMessage = {
        role: 'user',
        content: OUTPUT_TOKENS_RECOVERY_MESSAGE,
      }

      state.messages = [...messagesForQuery, assistantMessage, recoveryMessage]
      state.maxOutputTokensRecoveryCount = maxOutputTokensRecoveryCount + 1
      state.maxOutputTokensOverride = undefined
      state.transition = {
        reason: 'max_output_tokens_recovery',
        attempt: maxOutputTokensRecoveryCount + 1,
      }
      continue
    }

    // ------------------------------------------------------------------
    // Recovery: reactive compact (prompt too long after accumulation)
    // ------------------------------------------------------------------
    if (
      stopReason === 'max_tokens' &&
      toolUseBlocks.length === 0 &&
      !state.hasAttemptedReactiveCompact
    ) {
      try {
        const compactResult = await doAutoCompact(
          [...messagesForQuery, assistantMessage],
          params.model,
          params.provider,
          autoCompactTracking,
        )
        if (compactResult.compacted) {
          yield {
            type: 'recovery',
            reason: 'reactive_compact_retry',
          } as QueryEvent

          state.messages = compactResult.messages
          state.hasAttemptedReactiveCompact = true
          autoCompactTracking = compactResult.tracking
          state.transition = { reason: 'reactive_compact_retry' }
          continue
        }
      } catch {
        // Compaction failed
      }
    }

    // ------------------------------------------------------------------
    // Step 4: Check if we need tool execution
    // ------------------------------------------------------------------
    const needsToolExecution = toolUseBlocks.length > 0 && stopReason === 'tool_use'

    if (!needsToolExecution) {
      // No tools — conversation turn complete
      yield {
        type: 'turn_complete',
        turnCount,
        stopReason,
      } as QueryEvent

      // Add assistant message to history for future reference
      state.messages = [...messagesForQuery, assistantMessage]
      return { reason: 'completed', finalMessages: state.messages }
    }

    // ------------------------------------------------------------------
    // Step 5: Execute tools with permission checks
    // ------------------------------------------------------------------
    const toolResults: ContentBlock[] = []
    const executor = new StreamingToolExecutor(params.tools, toolUseContext)

    // Add all tool blocks to the executor
    for (const tb of toolUseBlocks) {
      const toolDef = findToolByName(params.tools, tb.name)

      if (!toolDef) {
        // Unknown tool — immediate error result
        const errorMsg = `Error: No such tool available: ${tb.name}`
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: errorMsg,
          is_error: true,
        })
        yield {
          type: 'tool_result',
          toolUseId: tb.id,
          toolName: tb.name,
          output: errorMsg,
          isError: true,
        } as QueryEvent
        continue
      }

      // Permission check
      const permResult = await params.canUseTool(
        toolDef,
        tb.input,
        toolUseContext,
        assistantMessage,
        tb.id,
      )

      if (permResult.behavior === 'deny') {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: permResult.message || `Permission denied for ${tb.name}`,
          is_error: true,
        })
        yield {
          type: 'tool_result',
          toolUseId: tb.id,
          toolName: tb.name,
          output: permResult.message || `Permission denied for ${tb.name}`,
          isError: true,
        } as QueryEvent
        continue
      }

      if (permResult.behavior === 'ask') {
        // In non-interactive mode, deny
        if (!toolUseContext.requestPrompt) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: permResult.message || `Permission required for ${tb.name} (non-interactive mode)`,
            is_error: true,
          })
          yield {
            type: 'tool_result',
            toolUseId: tb.id,
            toolName: tb.name,
            output: permResult.message || `Permission required (non-interactive)`,
            isError: true,
          } as QueryEvent
          continue
        }

        // Interactive: prompt the user
        try {
          const inputSummary = tb.input ? Object.entries(tb.input)
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? (v.length > 80 ? v.slice(0, 80) + '...' : v) : JSON.stringify(v)}`)
            .join(', ') : null
          const promptFn = toolUseContext.requestPrompt(tb.name, inputSummary)
          const response = await promptFn({
            message: permResult.message || `Allow ${tb.name}?`,
          })
          if (response.response !== 'yes' && response.response !== 'y') {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tb.id,
              content: `User denied permission for ${tb.name}`,
              is_error: true,
            })
            continue
          }
        } catch {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: `Permission prompt failed for ${tb.name}`,
            is_error: true,
          })
          continue
        }
      }

      // Use updated input if permission check modified it
      const finalInput = permResult.updatedInput ?? tb.input
      executor.addTool({ ...tb, input: finalInput })
    }

    // Collect executor results
    for await (const event of executor.getResults()) {
      yield event as QueryEvent

      if (event.type === 'tool_result') {
        toolResults.push(event.result.contentBlock)
      }
    }

    // Check abort after tool execution
    if (toolUseContext.abortController.signal.aborted) {
      return { reason: 'aborted_tools', finalMessages: state.messages }
    }

    // ------------------------------------------------------------------
    // Step 6: Build tool results message and continue
    // ------------------------------------------------------------------
    const toolResultsMessage: UnifiedMessage = {
      role: 'user',
      content: toolResults,
    }

    yield {
      type: 'turn_complete',
      turnCount,
      stopReason,
    } as QueryEvent

    // Update state for next turn
    state.messages = [...messagesForQuery, assistantMessage, toolResultsMessage]
    state.turnCount = turnCount + 1
    state.maxOutputTokensRecoveryCount = 0
    state.hasAttemptedReactiveCompact = false
    state.maxOutputTokensOverride = undefined
    state.transition = { reason: 'next_turn' }
  }
}
