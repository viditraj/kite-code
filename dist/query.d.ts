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
import type { QueryParams, QueryEvent, Terminal } from './query/deps.js';
/**
 * Main query async generator.
 *
 * Yields QueryEvent objects as the agent loop progresses.
 * Returns a Terminal value when the loop ends.
 */
export declare function query(params: QueryParams): AsyncGenerator<QueryEvent, Terminal, undefined>;
//# sourceMappingURL=query.d.ts.map