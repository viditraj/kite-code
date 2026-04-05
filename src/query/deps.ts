/**
 * Query loop dependency injection interface.
 *
 * Implements the same DI pattern as Claude Code's query/deps.ts:
 * - All external dependencies are injectable for testing
 * - Default implementations provided for production
 * - QueryParams, QueryState, Terminal, Continue types
 */

import { randomUUID } from 'crypto'
import type { LLMProvider, StreamEvent, UnifiedMessage, TokenUsage, ChatRequest, ContentBlock, StopReason } from '../providers/types.js'
import type { Tool, Tools, ToolUseContext, CanUseToolFn } from '../Tool.js'
import type { ToolPermissionContext } from '../types/permissions.js'

// ============================================================================
// Query Event — events yielded by the query async generator
// ============================================================================

export type QueryEvent =
  | StreamEvent
  | { type: 'tool_start'; toolUseId: string; toolName: string }
  | { type: 'tool_progress'; toolUseId: string; message: string }
  | { type: 'tool_result'; toolUseId: string; toolName: string; output: string; isError: boolean }
  | { type: 'turn_start'; turnCount: number }
  | { type: 'turn_complete'; turnCount: number; stopReason: StopReason }
  | { type: 'recovery'; reason: string; detail?: string }
  | { type: 'max_turns_reached'; maxTurns: number; turnCount: number }
  | { type: 'compact'; reason: string; messagesBefore: number; messagesAfter: number }

// ============================================================================
// Terminal — how the query loop ends
// ============================================================================

export type Terminal =
  | { reason: 'completed'; finalMessages: UnifiedMessage[] }
  | { reason: 'aborted_streaming'; finalMessages: UnifiedMessage[] }
  | { reason: 'aborted_tools'; finalMessages: UnifiedMessage[] }
  | { reason: 'blocking_limit'; finalMessages: UnifiedMessage[] }
  | { reason: 'model_error'; error: Error; finalMessages: UnifiedMessage[] }
  | { reason: 'max_turns'; turnCount: number; finalMessages: UnifiedMessage[] }
  | { reason: 'prompt_too_long'; finalMessages: UnifiedMessage[] }

// ============================================================================
// Continue — how recovery paths update loop state
// ============================================================================

export type Continue =
  | { reason: 'next_turn' }
  | { reason: 'max_output_tokens_recovery'; attempt: number }
  | { reason: 'reactive_compact_retry' }

// ============================================================================
// Query Source
// ============================================================================

export type QuerySource =
  | 'repl_main_thread'
  | 'agent'
  | 'compact'
  | 'sdk'
  | string

// ============================================================================
// QueryDeps — injectable dependencies
// ============================================================================

export interface QueryDeps {
  /** Call the LLM and stream back events */
  callModel(
    provider: LLMProvider,
    request: ChatRequest,
  ): AsyncGenerator<StreamEvent, void, undefined>

  /** Auto-compact messages when approaching context limit */
  autoCompact(
    messages: UnifiedMessage[],
    model: string,
    provider: LLMProvider,
  ): Promise<AutoCompactResult>

  /** Microcompact: compress tool results to save context space */
  microCompact(
    messages: UnifiedMessage[],
  ): UnifiedMessage[]

  /** Generate a UUID */
  uuid(): string
}

export interface AutoCompactResult {
  messages: UnifiedMessage[]
  compacted: boolean
  tokensFreed: number
}

// ============================================================================
// Default implementations
// ============================================================================

export function defaultCallModel(
  provider: LLMProvider,
  request: ChatRequest,
): AsyncGenerator<StreamEvent, void, undefined> {
  return provider.chat(request)
}

export function defaultMicroCompact(messages: UnifiedMessage[]): UnifiedMessage[] {
  // Pass through — full implementation in microCompact.ts
  return messages
}

export async function defaultAutoCompact(
  messages: UnifiedMessage[],
  _model: string,
  _provider: LLMProvider,
): Promise<AutoCompactResult> {
  return { messages, compacted: false, tokensFreed: 0 }
}

export function createDefaultDeps(): QueryDeps {
  return {
    callModel: defaultCallModel,
    autoCompact: defaultAutoCompact,
    microCompact: defaultMicroCompact,
    uuid: randomUUID,
  }
}

// ============================================================================
// QueryParams — what the caller passes to query()
// ============================================================================

export interface QueryParams {
  /** LLM provider instance */
  provider: LLMProvider
  /** Current messages (conversation history) */
  messages: UnifiedMessage[]
  /** System prompt text */
  systemPrompt: string
  /** Available tools */
  tools: Tools
  /** Tool use context for execution */
  toolUseContext: ToolUseContext
  /** Permission check function */
  canUseTool: CanUseToolFn
  /** Permission context for the engine */
  permissionContext: ToolPermissionContext
  /** Model name */
  model: string
  /** Max output tokens per turn */
  maxTokens: number
  /** Hard limit on loop iterations */
  maxTurns?: number
  /** Override max output tokens */
  maxOutputTokensOverride?: number
  /** Origin identifier */
  querySource?: QuerySource
  /** Injectable deps */
  deps?: Partial<QueryDeps>
}

// ============================================================================
// QueryState — mutable state across iterations
// ============================================================================

export interface QueryState {
  messages: UnifiedMessage[]
  toolUseContext: ToolUseContext
  turnCount: number
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  maxOutputTokensOverride: number | undefined
  transition: Continue | undefined
  cumulativeUsage: TokenUsage
}
