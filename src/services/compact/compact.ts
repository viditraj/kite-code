/**
 * LLM-based conversation compaction.
 *
 * Implements the same pattern as Claude Code's compact.ts:
 * - Summarize old conversation turns into a single summary
 * - Preserve recent messages and system context
 * - Use a smaller/cheaper model for summarization
 * - Maintain tool_use/tool_result pairs (never split them)
 */

import type { LLMProvider, UnifiedMessage, ContentBlock } from '../../providers/types.js'

// ============================================================================
// Constants
// ============================================================================

/** Number of recent messages to preserve (not compacted) */
const PRESERVE_RECENT = 4

/** Max tokens for the compaction summary */
const COMPACT_MAX_TOKENS = 4096

/** System prompt for the compaction model */
const COMPACT_SYSTEM_PROMPT = `You are a conversation summarizer. Summarize the following conversation history into a concise but complete summary that preserves:
1. All key decisions and context
2. File paths and code references mentioned
3. Current state of any ongoing tasks
4. Important errors or blockers encountered
5. What the user asked for and what has been done

Be factual and dense. Do not add commentary. Output only the summary.`

// ============================================================================
// Compaction logic
// ============================================================================

/**
 * Find the split point: how many messages from the start to compact.
 * We preserve the most recent PRESERVE_RECENT messages, but never split
 * a tool_use/tool_result pair.
 */
function findSplitPoint(messages: UnifiedMessage[]): number {
  if (messages.length <= PRESERVE_RECENT) return 0

  let splitAt = messages.length - PRESERVE_RECENT

  // Walk backward to avoid splitting tool_use/tool_result pairs
  // If messages[splitAt-1] is assistant with tool_use and messages[splitAt] is user with tool_result,
  // move split forward to include both
  while (splitAt > 0 && splitAt < messages.length) {
    const prevMsg = messages[splitAt - 1]!
    const curMsg = messages[splitAt]!

    // Check if prev has tool_use and current has tool_result
    const prevHasToolUse = Array.isArray(prevMsg.content) &&
      prevMsg.content.some((b: ContentBlock) => b.type === 'tool_use')
    const curHasToolResult = Array.isArray(curMsg.content) &&
      curMsg.content.some((b: ContentBlock) => b.type === 'tool_result')

    if (prevHasToolUse && curHasToolResult) {
      // Include the tool_result in the compacted portion
      splitAt++
    } else {
      break
    }
  }

  return splitAt
}

/**
 * Convert messages to a plain text representation for the summarizer.
 */
function messagesToText(messages: UnifiedMessage[]): string {
  const lines: string[] = []
  for (const msg of messages) {
    const role = msg.role.toUpperCase()
    if (typeof msg.content === 'string') {
      lines.push(`[${role}]: ${msg.content}`)
    } else if (Array.isArray(msg.content)) {
      const parts: string[] = []
      for (const block of msg.content) {
        switch (block.type) {
          case 'text':
            parts.push(block.text)
            break
          case 'tool_use':
            parts.push(`[Tool: ${block.name}](${JSON.stringify(block.input).slice(0, 200)})`)
            break
          case 'tool_result': {
            const content = typeof block.content === 'string'
              ? block.content.slice(0, 500)
              : JSON.stringify(block.content).slice(0, 500)
            parts.push(`[Result${block.is_error ? ' ERROR' : ''}]: ${content}`)
            break
          }
          case 'thinking':
            parts.push(`[Thinking]: ${block.thinking.slice(0, 200)}`)
            break
        }
      }
      lines.push(`[${role}]: ${parts.join('\n')}`)
    }
  }
  return lines.join('\n\n')
}

// ============================================================================
// compact — entry point
// ============================================================================

export interface CompactResult {
  messages: UnifiedMessage[]
  compacted: boolean
  compactedCount: number
  tokensFreed: number
}

/**
 * Compact conversation history using an LLM summarizer.
 *
 * - Splits messages into [old] and [recent]
 * - Summarizes [old] into a single user message
 * - Returns [summary, ...recent]
 */
export async function compact(
  messages: UnifiedMessage[],
  provider: LLMProvider,
  model: string,
): Promise<CompactResult> {
  const splitAt = findSplitPoint(messages)
  if (splitAt <= 1) {
    // Nothing worth compacting
    return { messages, compacted: false, compactedCount: 0, tokensFreed: 0 }
  }

  const toCompact = messages.slice(0, splitAt)
  const toPreserve = messages.slice(splitAt)
  const conversationText = messagesToText(toCompact)

  // Estimate tokens before compaction
  const beforeChars = conversationText.length

  // Call the LLM to summarize
  let summary = ''
  try {
    const stream = provider.chat({
      model,
      messages: [{ role: 'user', content: `Summarize this conversation history:\n\n${conversationText}` }],
      system: COMPACT_SYSTEM_PROMPT,
      maxTokens: COMPACT_MAX_TOKENS,
      stream: true,
    })

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        summary += event.text
      }
    }
  } catch {
    // If compaction fails, return original messages
    return { messages, compacted: false, compactedCount: 0, tokensFreed: 0 }
  }

  if (!summary.trim()) {
    return { messages, compacted: false, compactedCount: 0, tokensFreed: 0 }
  }

  const summaryMessage: UnifiedMessage = {
    role: 'user',
    content: `[Conversation Summary]\n${summary.trim()}\n\n[End of summary — conversation continues below]`,
  }

  const result: UnifiedMessage[] = [summaryMessage, ...toPreserve]
  const afterChars = summary.length
  const tokensFreed = Math.max(0, Math.ceil((beforeChars - afterChars) / 4))

  return {
    messages: result,
    compacted: true,
    compactedCount: splitAt,
    tokensFreed,
  }
}

// Re-export for testing
export { PRESERVE_RECENT, COMPACT_MAX_TOKENS, findSplitPoint, messagesToText }
