/**
 * Query loop dependency injection interface.
 *
 * Implements the same DI pattern as Claude Code's query/deps.ts:
 * - All external dependencies are injectable for testing
 * - Default implementations provided for production
 * - QueryParams, QueryState, Terminal, Continue types
 */
import type { LLMProvider, StreamEvent, UnifiedMessage, TokenUsage, ChatRequest, StopReason } from '../providers/types.js';
import type { Tools, ToolUseContext, CanUseToolFn } from '../Tool.js';
import type { ToolPermissionContext } from '../types/permissions.js';
export type QueryEvent = StreamEvent | {
    type: 'tool_start';
    toolUseId: string;
    toolName: string;
} | {
    type: 'tool_progress';
    toolUseId: string;
    message: string;
} | {
    type: 'tool_result';
    toolUseId: string;
    toolName: string;
    output: string;
    isError: boolean;
} | {
    type: 'turn_start';
    turnCount: number;
} | {
    type: 'turn_complete';
    turnCount: number;
    stopReason: StopReason;
} | {
    type: 'recovery';
    reason: string;
    detail?: string;
} | {
    type: 'max_turns_reached';
    maxTurns: number;
    turnCount: number;
} | {
    type: 'compact';
    reason: string;
    messagesBefore: number;
    messagesAfter: number;
};
export type Terminal = {
    reason: 'completed';
    finalMessages: UnifiedMessage[];
} | {
    reason: 'aborted_streaming';
    finalMessages: UnifiedMessage[];
} | {
    reason: 'aborted_tools';
    finalMessages: UnifiedMessage[];
} | {
    reason: 'blocking_limit';
    finalMessages: UnifiedMessage[];
} | {
    reason: 'model_error';
    error: Error;
    finalMessages: UnifiedMessage[];
} | {
    reason: 'max_turns';
    turnCount: number;
    finalMessages: UnifiedMessage[];
} | {
    reason: 'prompt_too_long';
    finalMessages: UnifiedMessage[];
};
export type Continue = {
    reason: 'next_turn';
} | {
    reason: 'max_output_tokens_recovery';
    attempt: number;
} | {
    reason: 'reactive_compact_retry';
};
export type QuerySource = 'repl_main_thread' | 'agent' | 'compact' | 'sdk' | string;
export interface QueryDeps {
    /** Call the LLM and stream back events */
    callModel(provider: LLMProvider, request: ChatRequest): AsyncGenerator<StreamEvent, void, undefined>;
    /** Auto-compact messages when approaching context limit */
    autoCompact(messages: UnifiedMessage[], model: string, provider: LLMProvider): Promise<AutoCompactResult>;
    /** Microcompact: compress tool results to save context space */
    microCompact(messages: UnifiedMessage[]): UnifiedMessage[];
    /** Generate a UUID */
    uuid(): string;
}
export interface AutoCompactResult {
    messages: UnifiedMessage[];
    compacted: boolean;
    tokensFreed: number;
}
export declare function defaultCallModel(provider: LLMProvider, request: ChatRequest): AsyncGenerator<StreamEvent, void, undefined>;
export declare function defaultMicroCompact(messages: UnifiedMessage[]): UnifiedMessage[];
export declare function defaultAutoCompact(messages: UnifiedMessage[], _model: string, _provider: LLMProvider): Promise<AutoCompactResult>;
export declare function createDefaultDeps(): QueryDeps;
export interface QueryParams {
    /** LLM provider instance */
    provider: LLMProvider;
    /** Current messages (conversation history) */
    messages: UnifiedMessage[];
    /** System prompt text */
    systemPrompt: string;
    /** Available tools */
    tools: Tools;
    /** Tool use context for execution */
    toolUseContext: ToolUseContext;
    /** Permission check function */
    canUseTool: CanUseToolFn;
    /** Permission context for the engine */
    permissionContext: ToolPermissionContext;
    /** Model name */
    model: string;
    /** Max output tokens per turn */
    maxTokens: number;
    /** Hard limit on loop iterations */
    maxTurns?: number;
    /** Override max output tokens */
    maxOutputTokensOverride?: number;
    /** Origin identifier */
    querySource?: QuerySource;
    /** Injectable deps */
    deps?: Partial<QueryDeps>;
}
export interface QueryState {
    messages: UnifiedMessage[];
    toolUseContext: ToolUseContext;
    turnCount: number;
    maxOutputTokensRecoveryCount: number;
    hasAttemptedReactiveCompact: boolean;
    maxOutputTokensOverride: number | undefined;
    transition: Continue | undefined;
    cumulativeUsage: TokenUsage;
}
//# sourceMappingURL=deps.d.ts.map