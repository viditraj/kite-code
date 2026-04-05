/**
 * SessionPreview — Session card for resume display.
 *
 * Shows a compact card with session info: ID, date, message count,
 * first message preview, and model used. Purely presentational.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionPreviewProps {
  /** Unique session identifier. */
  sessionId: string
  /** Human-readable date string. */
  date: string
  /** Number of messages in the session. */
  messageCount: number
  /** First message content (truncated). */
  firstMessage?: string
  /** Model used in this session. */
  model?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionPreview({
  sessionId,
  date,
  messageCount,
  firstMessage,
  model,
}: SessionPreviewProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
    >
      {/* Top row: ID + date */}
      <Box>
        <Text color="cyan" bold>
          {'\u25CF'} Session
        </Text>
        <Text dimColor>{' #'}{sessionId.slice(0, 8)}</Text>
        <Text>{'  '}</Text>
        <Text dimColor>{date}</Text>
      </Box>

      {/* Stats row */}
      <Box>
        <Text>
          {'\u2514'} {messageCount} message{messageCount !== 1 ? 's' : ''}
        </Text>
        {model && (
          <Box>
            <Text dimColor>{' \u00B7 '}</Text>
            <Text color="magenta">{model}</Text>
          </Box>
        )}
      </Box>

      {/* First message preview */}
      {firstMessage && (
        <Box marginTop={0}>
          <Text dimColor>
            {'  \u201C'}
            {truncate(firstMessage.replace(/\n/g, ' '), 60)}
            {'\u201D'}
          </Text>
        </Box>
      )}
    </Box>
  )
}
