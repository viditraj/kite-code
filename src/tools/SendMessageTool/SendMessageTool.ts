/**
 * SendMessageTool — Send a message to another agent or channel.
 *
 * Stores messages in appState.messages for inter-agent communication.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const SEND_MESSAGE_TOOL_NAME = 'SendMessage'

const inputSchema = z.strictObject({
  recipient: z.string().describe('The recipient agent ID or channel name'),
  message: z.string().describe('The message content to send'),
})

type SendMessageInput = z.infer<typeof inputSchema>

interface StoredMessage {
  id: string
  sender: string
  recipient: string
  message: string
  timestamp: string
}

interface SendMessageOutput {
  id: string
  recipient: string
  message: string
  delivered: boolean
}

export const SendMessageTool = buildTool({
  name: SEND_MESSAGE_TOOL_NAME,
  searchHint: 'send message to agent channel communication',
  maxResultSizeChars: 10_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return false
  },

  isConcurrencySafe() {
    return false
  },

  async description({ recipient }: SendMessageInput) {
    return `Send message to "${recipient}"`
  },

  async prompt() {
    return `Send a message to another agent or communication channel.

Input:
- recipient: The target agent ID or channel name (e.g., "agent-1", "main", "notifications")
- message: The message content to send

Messages are stored in the session state and can be retrieved by the recipient.
Use this for inter-agent communication when working with multiple agents or subagents.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'SendMessage'
  },

  toAutoClassifierInput(input: SendMessageInput) {
    return `send message to ${input.recipient}`
  },

  getToolUseSummary(input?: Partial<SendMessageInput>) {
    if (!input?.recipient) return null
    return `Sending message to "${input.recipient}"`
  },

  getActivityDescription(input?: Partial<SendMessageInput>) {
    if (!input?.recipient) return 'Sending message'
    const preview = input.message
      ? input.message.length > 50
        ? input.message.slice(0, 50) + '...'
        : input.message
      : ''
    return preview
      ? `Sending to "${input.recipient}": ${preview}`
      : `Sending message to "${input.recipient}"`
  },

  async validateInput(input: SendMessageInput) {
    if (!input.recipient || !input.recipient.trim()) {
      return { result: false, message: 'Recipient cannot be empty', errorCode: 1 }
    }
    if (!input.message || !input.message.trim()) {
      return { result: false, message: 'Message cannot be empty', errorCode: 2 }
    }
    return { result: true }
  },

  async call(input: SendMessageInput, context: ToolUseContext) {
    const sender = context.agentId ?? 'main'
    const messageId = randomUUID()

    const storedMessage: StoredMessage = {
      id: messageId,
      sender,
      recipient: input.recipient.trim(),
      message: input.message.trim(),
      timestamp: new Date().toISOString(),
    }

    context.setAppState((prev: Record<string, unknown>) => {
      const messages = Array.isArray(prev.messages)
        ? (prev.messages as StoredMessage[])
        : []
      return {
        ...prev,
        messages: [...messages, storedMessage],
      }
    })

    return {
      data: {
        id: messageId,
        recipient: input.recipient.trim(),
        message: input.message.trim(),
        delivered: true,
      } as SendMessageOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: SendMessageOutput, toolUseID: string) {
    const text = content.delivered
      ? `Message sent to "${content.recipient}" (id: ${content.id})`
      : `Failed to send message to "${content.recipient}"`

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: text,
      is_error: !content.delivered,
    }
  },
})

export { SEND_MESSAGE_TOOL_NAME }
