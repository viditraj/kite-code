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

import type { UnifiedMessage, ContentBlock, TokenUsage } from '../providers/types.js'

// ============================================================================
// Message type predicates
// ============================================================================

export function isUserMessage(msg: UnifiedMessage): boolean {
  return msg.role === 'user'
}

export function isAssistantMessage(msg: UnifiedMessage): boolean {
  return msg.role === 'assistant'
}

export function isSystemMessage(msg: UnifiedMessage): boolean {
  return msg.role === 'system'
}

export function isHumanTurn(msg: UnifiedMessage): boolean {
  return msg.role === 'user'
}

export function isAssistantTurn(msg: UnifiedMessage): boolean {
  return msg.role === 'assistant'
}

// ============================================================================
// Content extraction
// ============================================================================

/**
 * Extract plain text from a message's content.
 * Handles both string content and ContentBlock arrays.
 */
export function getTextContent(msg: UnifiedMessage): string {
  if (typeof msg.content === 'string') return msg.content

  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('')
  }

  return ''
}

/**
 * Extract all text blocks from a message.
 */
export function getTextBlocks(msg: UnifiedMessage): Array<{ type: 'text'; text: string }> {
  if (typeof msg.content === 'string') {
    return [{ type: 'text', text: msg.content }]
  }

  if (Array.isArray(msg.content)) {
    return msg.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text')
  }

  return []
}

/**
 * Extract tool_use blocks from a message.
 */
export function getToolUseBlocks(msg: UnifiedMessage): Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> {
  if (!Array.isArray(msg.content)) return []
  return msg.content.filter(
    (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      b.type === 'tool_use',
  )
}

/**
 * Extract tool_result blocks from a message.
 */
export function getToolResultBlocks(msg: UnifiedMessage): Array<ContentBlock & { type: 'tool_result' }> {
  if (!Array.isArray(msg.content)) return []
  return msg.content.filter(
    (b): b is ContentBlock & { type: 'tool_result' } => b.type === 'tool_result',
  )
}

/**
 * Extract thinking blocks from a message.
 */
export function getThinkingBlocks(msg: UnifiedMessage): Array<{ type: 'thinking'; thinking: string }> {
  if (!Array.isArray(msg.content)) return []
  return msg.content.filter(
    (b): b is { type: 'thinking'; thinking: string } => b.type === 'thinking',
  )
}

/**
 * Check if a message has any tool_use blocks.
 */
export function hasToolUse(msg: UnifiedMessage): boolean {
  return getToolUseBlocks(msg).length > 0
}

/**
 * Check if a message has any tool_result blocks.
 */
export function hasToolResult(msg: UnifiedMessage): boolean {
  return getToolResultBlocks(msg).length > 0
}

// ============================================================================
// Token estimation
// ============================================================================

/**
 * Rough token count estimation for a message.
 * ~4 chars per token for text, plus overhead for structured blocks.
 */
export function estimateMessageTokens(msg: UnifiedMessage): number {
  if (typeof msg.content === 'string') {
    return Math.ceil(msg.content.length / 4) + 4 // +4 for message overhead
  }

  if (Array.isArray(msg.content)) {
    let chars = 0
    for (const block of msg.content) {
      switch (block.type) {
        case 'text':
          chars += block.text.length
          break
        case 'tool_use':
          chars += JSON.stringify(block.input).length + 50 // name + overhead
          break
        case 'tool_result': {
          const content = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content)
          chars += content.length + 20
          break
        }
        case 'thinking':
          chars += block.thinking.length
          break
        case 'image':
          chars += 1000 // rough estimate for image tokens
          break
        default:
          chars += 50
      }
    }
    return Math.ceil(chars / 4) + 4
  }

  return 4
}

/**
 * Estimate total tokens for a conversation.
 */
export function estimateConversationTokens(messages: UnifiedMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

// ============================================================================
// Message counting
// ============================================================================

/**
 * Count messages by role.
 */
export function countMessagesByRole(messages: UnifiedMessage[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const msg of messages) {
    counts[msg.role] = (counts[msg.role] ?? 0) + 1
  }
  return counts
}

/**
 * Count total tool uses across all messages.
 */
export function countToolUses(messages: UnifiedMessage[]): number {
  let count = 0
  for (const msg of messages) {
    count += getToolUseBlocks(msg).length
  }
  return count
}

/**
 * Count total tool results across all messages.
 */
export function countToolResults(messages: UnifiedMessage[]): number {
  let count = 0
  for (const msg of messages) {
    count += getToolResultBlocks(msg).length
  }
  return count
}

// ============================================================================
// Message formatting
// ============================================================================

/**
 * Format a message for plain text display.
 */
export function formatMessagePlainText(msg: UnifiedMessage): string {
  const role = msg.role.toUpperCase()
  const text = getTextContent(msg)
  const toolUses = getToolUseBlocks(msg)
  const toolResults = getToolResultBlocks(msg)

  const parts = [`[${role}]`]

  if (text) parts.push(text)

  for (const tu of toolUses) {
    parts.push(`[Tool: ${tu.name}](${JSON.stringify(tu.input).slice(0, 100)})`)
  }

  for (const tr of toolResults) {
    const content = typeof tr.content === 'string'
      ? tr.content.slice(0, 200)
      : JSON.stringify(tr.content).slice(0, 200)
    parts.push(`[Result${tr.is_error ? ' ERROR' : ''}]: ${content}`)
  }

  return parts.join('\n')
}

/**
 * Format an entire conversation for export.
 */
export function formatConversationMarkdown(messages: UnifiedMessage[]): string {
  const lines: string[] = ['# Conversation Export', '', `Exported: ${new Date().toISOString()}`, '']

  for (const msg of messages) {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
    lines.push(`## ${role}`, '')
    lines.push(getTextContent(msg) || '(no text content)')

    const toolUses = getToolUseBlocks(msg)
    if (toolUses.length > 0) {
      lines.push('')
      for (const tu of toolUses) {
        lines.push(`**Tool: ${tu.name}**`)
        lines.push('```json')
        lines.push(JSON.stringify(tu.input, null, 2))
        lines.push('```')
      }
    }

    const toolResults = getToolResultBlocks(msg)
    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        const content = typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
        lines.push('')
        lines.push(tr.is_error ? '**Error:**' : '**Result:**')
        lines.push('```')
        lines.push(content.slice(0, 2000))
        lines.push('```')
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Conversation filtering
// ============================================================================

/**
 * Get the last N messages from a conversation.
 */
export function getLastMessages(messages: UnifiedMessage[], count: number): UnifiedMessage[] {
  return messages.slice(-count)
}

/**
 * Get the last assistant message from a conversation.
 */
export function getLastAssistantMessage(messages: UnifiedMessage[]): UnifiedMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') return messages[i]
  }
  return undefined
}

/**
 * Get the last user message from a conversation.
 */
export function getLastUserMessage(messages: UnifiedMessage[]): UnifiedMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') return messages[i]
  }
  return undefined
}

/**
 * Filter messages to only include user and assistant turns (no tool results, system, etc.)
 */
export function getConversationTurns(messages: UnifiedMessage[]): UnifiedMessage[] {
  return messages.filter(m => m.role === 'user' || m.role === 'assistant')
}

/**
 * Check if conversation has any assistant responses.
 */
export function hasAssistantResponse(messages: UnifiedMessage[]): boolean {
  return messages.some(m => m.role === 'assistant')
}

/**
 * Remove thinking blocks from messages (for display purposes).
 */
export function stripThinkingBlocks(messages: UnifiedMessage[]): UnifiedMessage[] {
  return messages.map(msg => {
    if (!Array.isArray(msg.content)) return msg

    const filtered = msg.content.filter(b => b.type !== 'thinking')
    if (filtered.length === msg.content.length) return msg

    return { ...msg, content: filtered }
  })
}

/**
 * Normalize messages for API consumption.
 * Ensures alternating user/assistant roles, merges adjacent same-role messages.
 */
export function normalizeMessagesForAPI(messages: UnifiedMessage[]): UnifiedMessage[] {
  if (messages.length === 0) return []

  const result: UnifiedMessage[] = []

  for (const msg of messages) {
    const lastMsg = result.at(-1)

    // Merge adjacent same-role messages
    if (lastMsg && lastMsg.role === msg.role) {
      const lastContent = typeof lastMsg.content === 'string'
        ? [{ type: 'text' as const, text: lastMsg.content }]
        : lastMsg.content

      const newContent = typeof msg.content === 'string'
        ? [{ type: 'text' as const, text: msg.content }]
        : msg.content

      result[result.length - 1] = {
        role: msg.role,
        content: [...(lastContent as ContentBlock[]), ...(newContent as ContentBlock[])],
      }
    } else {
      result.push(msg)
    }
  }

  return result
}

/**
 * Truncate message content to a maximum character length.
 */
export function truncateMessageContent(msg: UnifiedMessage, maxChars: number): UnifiedMessage {
  if (typeof msg.content === 'string') {
    if (msg.content.length <= maxChars) return msg
    return { ...msg, content: msg.content.slice(0, maxChars) + '... [truncated]' }
  }

  if (Array.isArray(msg.content)) {
    let totalChars = 0
    const truncated: ContentBlock[] = []

    for (const block of msg.content) {
      if (block.type === 'text') {
        const remaining = maxChars - totalChars
        if (remaining <= 0) break
        if (block.text.length > remaining) {
          truncated.push({ ...block, text: block.text.slice(0, remaining) + '... [truncated]' })
          break
        }
        totalChars += block.text.length
      }
      truncated.push(block)
    }

    return { ...msg, content: truncated }
  }

  return msg
}
