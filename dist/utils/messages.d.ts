/**
 * Message utilities — formatting, filtering, counting, and transformation.
 *
 * Implements the same patterns as Claude Code's utils/messages.ts:
 * - Message type predicates (isHumanTurn, isAssistantTurn, etc.)
 * - Content extraction (text from content blocks)
 * - Token estimation
 * - Message formatting for display
 * - Conversation filtering and slicing
 */
import type { UnifiedMessage, ContentBlock } from '../providers/types.js';
export declare function isUserMessage(msg: UnifiedMessage): boolean;
export declare function isAssistantMessage(msg: UnifiedMessage): boolean;
export declare function isSystemMessage(msg: UnifiedMessage): boolean;
export declare function isHumanTurn(msg: UnifiedMessage): boolean;
export declare function isAssistantTurn(msg: UnifiedMessage): boolean;
/**
 * Extract plain text from a message's content.
 * Handles both string content and ContentBlock arrays.
 */
export declare function getTextContent(msg: UnifiedMessage): string;
/**
 * Extract all text blocks from a message.
 */
export declare function getTextBlocks(msg: UnifiedMessage): Array<{
    type: 'text';
    text: string;
}>;
/**
 * Extract tool_use blocks from a message.
 */
export declare function getToolUseBlocks(msg: UnifiedMessage): Array<{
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}>;
/**
 * Extract tool_result blocks from a message.
 */
export declare function getToolResultBlocks(msg: UnifiedMessage): Array<ContentBlock & {
    type: 'tool_result';
}>;
/**
 * Extract thinking blocks from a message.
 */
export declare function getThinkingBlocks(msg: UnifiedMessage): Array<{
    type: 'thinking';
    thinking: string;
}>;
/**
 * Check if a message has any tool_use blocks.
 */
export declare function hasToolUse(msg: UnifiedMessage): boolean;
/**
 * Check if a message has any tool_result blocks.
 */
export declare function hasToolResult(msg: UnifiedMessage): boolean;
/**
 * Rough token count estimation for a message.
 * ~4 chars per token for text, plus overhead for structured blocks.
 */
export declare function estimateMessageTokens(msg: UnifiedMessage): number;
/**
 * Estimate total tokens for a conversation.
 */
export declare function estimateConversationTokens(messages: UnifiedMessage[]): number;
/**
 * Count messages by role.
 */
export declare function countMessagesByRole(messages: UnifiedMessage[]): Record<string, number>;
/**
 * Count total tool uses across all messages.
 */
export declare function countToolUses(messages: UnifiedMessage[]): number;
/**
 * Count total tool results across all messages.
 */
export declare function countToolResults(messages: UnifiedMessage[]): number;
/**
 * Format a message for plain text display.
 */
export declare function formatMessagePlainText(msg: UnifiedMessage): string;
/**
 * Format an entire conversation for export.
 */
export declare function formatConversationMarkdown(messages: UnifiedMessage[]): string;
/**
 * Get the last N messages from a conversation.
 */
export declare function getLastMessages(messages: UnifiedMessage[], count: number): UnifiedMessage[];
/**
 * Get the last assistant message from a conversation.
 */
export declare function getLastAssistantMessage(messages: UnifiedMessage[]): UnifiedMessage | undefined;
/**
 * Get the last user message from a conversation.
 */
export declare function getLastUserMessage(messages: UnifiedMessage[]): UnifiedMessage | undefined;
/**
 * Filter messages to only include user and assistant turns (no tool results, system, etc.)
 */
export declare function getConversationTurns(messages: UnifiedMessage[]): UnifiedMessage[];
/**
 * Check if conversation has any assistant responses.
 */
export declare function hasAssistantResponse(messages: UnifiedMessage[]): boolean;
/**
 * Remove thinking blocks from messages (for display purposes).
 */
export declare function stripThinkingBlocks(messages: UnifiedMessage[]): UnifiedMessage[];
/**
 * Normalize messages for API consumption.
 * Ensures alternating user/assistant roles, merges adjacent same-role messages.
 */
export declare function normalizeMessagesForAPI(messages: UnifiedMessage[]): UnifiedMessage[];
/**
 * Truncate message content to a maximum character length.
 */
export declare function truncateMessageContent(msg: UnifiedMessage, maxChars: number): UnifiedMessage;
//# sourceMappingURL=messages.d.ts.map