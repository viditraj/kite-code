/**
 * MessageList — Re-exports from MessageRow for backward compatibility.
 *
 * The new REPL uses MessageRow directly with <Static>, but other code
 * may still import from this file.
 */

export {
  type DisplayMessage,
  MessageRow,
  MessageDivider,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolResultMessage,
} from './MessageRow.js'

import React from 'react'
import { Box } from 'ink'
import { MessageRow, type DisplayMessage } from './MessageRow.js'

// Legacy MessageList component for backward compatibility
export interface MessageListProps {
  messages: DisplayMessage[]
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <Box flexDirection="column">
      {messages.map((message, index) => (
        <Box key={message.id} flexDirection="column" paddingBottom={index < messages.length - 1 ? 1 : 0}>
          <MessageRow message={message} />
        </Box>
      ))}
    </Box>
  )
}
