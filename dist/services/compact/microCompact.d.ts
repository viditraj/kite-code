/**
 * Microcompaction: compress large tool results to save context space.
 *
 * Implements the same pattern as Claude Code's microCompact.ts:
 * - Truncate oversized tool_result content
 * - Preserve structure of messages
 * - No LLM calls — pure string manipulation
 */
import type { UnifiedMessage } from '../../providers/types.js';
/** Max chars for a single tool_result content block before truncation */
declare const MAX_TOOL_RESULT_CHARS = 30000;
/** Max chars for a text block before truncation */
declare const MAX_TEXT_BLOCK_CHARS = 50000;
/** Marker inserted at the truncation point */
declare const TRUNCATION_MARKER = "\n\n... [output truncated] ...\n\n";
/**
 * Compress large tool results and text blocks in a message array.
 * No LLM calls — pure string manipulation.
 * Returns a new array (does not mutate input).
 */
export declare function microCompact(messages: UnifiedMessage[]): UnifiedMessage[];
export { MAX_TOOL_RESULT_CHARS, MAX_TEXT_BLOCK_CHARS, TRUNCATION_MARKER };
//# sourceMappingURL=microCompact.d.ts.map