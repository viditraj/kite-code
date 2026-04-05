/**
 * Microcompaction: compress large tool results to save context space.
 *
 * Implements the same pattern as Claude Code's microCompact.ts:
 * - Truncate oversized tool_result content
 * - Preserve structure of messages
 * - No LLM calls — pure string manipulation
 */
// ============================================================================
// Constants
// ============================================================================
/** Max chars for a single tool_result content block before truncation */
const MAX_TOOL_RESULT_CHARS = 30000;
/** Max chars for a text block before truncation */
const MAX_TEXT_BLOCK_CHARS = 50000;
/** Fraction of content to keep at start and end when truncating */
const KEEP_FRACTION = 0.4;
/** Marker inserted at the truncation point */
const TRUNCATION_MARKER = '\n\n... [output truncated] ...\n\n';
// ============================================================================
// Truncation helpers
// ============================================================================
/**
 * Truncate a string, keeping the beginning and end.
 * The middle is replaced with a truncation marker.
 */
function truncateMiddle(text, maxChars) {
    if (text.length <= maxChars)
        return text;
    const keepChars = maxChars - TRUNCATION_MARKER.length;
    if (keepChars <= 0)
        return text.slice(0, maxChars);
    const headChars = Math.floor(keepChars * KEEP_FRACTION);
    const tailChars = keepChars - headChars;
    return text.slice(0, headChars) + TRUNCATION_MARKER + text.slice(-tailChars);
}
// ============================================================================
// Content block compression
// ============================================================================
function compressContentBlock(block) {
    switch (block.type) {
        case 'tool_result': {
            if (typeof block.content === 'string' && block.content.length > MAX_TOOL_RESULT_CHARS) {
                return {
                    ...block,
                    content: truncateMiddle(block.content, MAX_TOOL_RESULT_CHARS),
                };
            }
            if (Array.isArray(block.content)) {
                return {
                    ...block,
                    content: block.content.map(compressContentBlock),
                };
            }
            return block;
        }
        case 'text': {
            if (block.text.length > MAX_TEXT_BLOCK_CHARS) {
                return {
                    ...block,
                    text: truncateMiddle(block.text, MAX_TEXT_BLOCK_CHARS),
                };
            }
            return block;
        }
        default:
            return block;
    }
}
// ============================================================================
// microCompact — entry point
// ============================================================================
/**
 * Compress large tool results and text blocks in a message array.
 * No LLM calls — pure string manipulation.
 * Returns a new array (does not mutate input).
 */
export function microCompact(messages) {
    return messages.map(msg => {
        if (typeof msg.content === 'string') {
            if (msg.content.length > MAX_TEXT_BLOCK_CHARS) {
                return { ...msg, content: truncateMiddle(msg.content, MAX_TEXT_BLOCK_CHARS) };
            }
            return msg;
        }
        if (Array.isArray(msg.content)) {
            const compressed = msg.content.map(compressContentBlock);
            // Only create a new object if something changed
            const changed = compressed.some((b, i) => b !== msg.content[i]);
            return changed ? { ...msg, content: compressed } : msg;
        }
        return msg;
    });
}
// Re-export constants for testing
export { MAX_TOOL_RESULT_CHARS, MAX_TEXT_BLOCK_CHARS, TRUNCATION_MARKER };
//# sourceMappingURL=microCompact.js.map