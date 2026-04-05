/**
 * LLM-based conversation compaction.
 *
 * Implements the same pattern as Claude Code's compact.ts:
 * - Summarize old conversation turns into a single summary
 * - Preserve recent messages and system context
 * - Use a smaller/cheaper model for summarization
 * - Maintain tool_use/tool_result pairs (never split them)
 */
import type { LLMProvider, UnifiedMessage } from '../../providers/types.js';
/** Number of recent messages to preserve (not compacted) */
declare const PRESERVE_RECENT = 4;
/** Max tokens for the compaction summary */
declare const COMPACT_MAX_TOKENS = 4096;
/**
 * Find the split point: how many messages from the start to compact.
 * We preserve the most recent PRESERVE_RECENT messages, but never split
 * a tool_use/tool_result pair.
 */
declare function findSplitPoint(messages: UnifiedMessage[]): number;
/**
 * Convert messages to a plain text representation for the summarizer.
 */
declare function messagesToText(messages: UnifiedMessage[]): string;
export interface CompactResult {
    messages: UnifiedMessage[];
    compacted: boolean;
    compactedCount: number;
    tokensFreed: number;
}
/**
 * Compact conversation history using an LLM summarizer.
 *
 * - Splits messages into [old] and [recent]
 * - Summarizes [old] into a single user message
 * - Returns [summary, ...recent]
 */
export declare function compact(messages: UnifiedMessage[], provider: LLMProvider, model: string): Promise<CompactResult>;
export { PRESERVE_RECENT, COMPACT_MAX_TOKENS, findSplitPoint, messagesToText };
//# sourceMappingURL=compact.d.ts.map