/**
 * MessageRow — Rich message rendering for the REPL.
 *
 * Each message type gets distinct visual treatment:
 * - User messages: green prefix, plain text
 * - Assistant messages: gradient-styled prefix, markdown rendering
 * - System messages: yellow with icon
 * - Tool results: cyan with type-specific formatting (file changes, bash output, etc.)
 */

import React from 'react'
import { Box, Text } from 'ink'
import Gradient from 'ink-gradient'
import { MarkdownText } from '../MarkdownText.js'
import { getColor } from '../../themes/activeTheme.js'
import { MessageTimestamp } from './MessageTimestamp.js'

// ============================================================================
// Types
// ============================================================================

export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool_result'
  content: string
  toolName?: string
  toolUseId?: string
  isError?: boolean
  isThinking?: boolean
  timestamp?: number
}

// ============================================================================
// Constants
// ============================================================================

const MAX_TOOL_CONTENT = 500

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '... (truncated)'
}

// ============================================================================
// Tool result formatters — type-specific display
// ============================================================================

function isFileWriteResult(content: string): { path: string; bytes: number } | null {
  try {
    const d = JSON.parse(content)
    if (d.filePath && d.bytesWritten !== undefined) return { path: d.filePath, bytes: d.bytesWritten }
  } catch {}
  return null
}

function isFileEditResult(content: string): { path: string; count: number } | null {
  try {
    const d = JSON.parse(content)
    if (d.filePath && d.replacements !== undefined) return { path: d.filePath, count: d.replacements }
  } catch {}
  return null
}

function isBashResult(content: string): { stdout: string; exitCode: number; duration?: number } | null {
  try {
    const d = JSON.parse(content)
    if (d.stdout !== undefined && d.exitCode !== undefined) return { stdout: d.stdout, exitCode: d.exitCode, duration: d.durationMs }
  } catch {}
  return null
}

// ============================================================================
// User Message
// ============================================================================

export const UserMessage: React.FC<{ content: string; timestamp?: number }> = ({ content, timestamp }) => (
  <Box flexDirection="column">
    <Box>
      <Text color={getColor('success')} bold>{'\u276F '}</Text>
      <Text color={getColor('success')} bold>You</Text>
      {timestamp != null && (
        <>
          <Text dimColor> </Text>
          <MessageTimestamp timestamp={timestamp} />
        </>
      )}
    </Box>
    <Box marginLeft={2}>
      <Text>{content}</Text>
    </Box>
  </Box>
)

// ============================================================================
// Assistant Message — with markdown rendering
// ============================================================================

export const AssistantMessage: React.FC<{ content: string; isThinking?: boolean; timestamp?: number }> = ({ content, isThinking, timestamp }) => {
  if (isThinking) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="magenta" dimColor>{'\u25C7 '}</Text>
          <Text dimColor italic>thinking...</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor italic>{content}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={getColor('kite_brand')} bold>{'\u25C6 Kite'}</Text>
        {timestamp != null && (
          <>
            <Text dimColor> </Text>
            <MessageTimestamp timestamp={timestamp} />
          </>
        )}
      </Box>
      <Box marginLeft={2}>
        <MarkdownText>{content}</MarkdownText>
      </Box>
    </Box>
  )
}

// ============================================================================
// System Message
// ============================================================================

export const SystemMessage: React.FC<{ content: string }> = ({ content }) => (
  <Box flexDirection="column">
    <Box>
      <Text color={getColor('warning')} bold>{'\u2699 '}</Text>
      <Text color={getColor('warning')} bold>System</Text>
    </Box>
    <Box marginLeft={2}>
      <Text color={getColor('warning')}>{content}</Text>
    </Box>
  </Box>
)

// ============================================================================
// Tool Result Message — with type-specific formatting
// ============================================================================

export const ToolResultMessage: React.FC<{
  toolName: string
  content: string
  isError?: boolean
}> = ({ toolName, content, isError }) => {
  // Try type-specific rendering
  const writeResult = isFileWriteResult(content)
  if (writeResult && !isError) {
    return (
      <Box>
        <Text color={getColor('primary')} bold>{'\u2B21 '}</Text>
        <Text color={getColor('primary')} bold>{toolName}</Text>
        <Text color="green">{' + '}</Text>
        <Text>{writeResult.path}</Text>
        <Text dimColor> ({writeResult.bytes} bytes)</Text>
      </Box>
    )
  }

  const editResult = isFileEditResult(content)
  if (editResult && !isError) {
    return (
      <Box>
        <Text color={getColor('primary')} bold>{'\u2B21 '}</Text>
        <Text color={getColor('primary')} bold>{toolName}</Text>
        <Text color="yellow">{' ~ '}</Text>
        <Text>{editResult.path}</Text>
        <Text dimColor> ({editResult.count} replacement{editResult.count !== 1 ? 's' : ''})</Text>
      </Box>
    )
  }

  const bashResult = isBashResult(content)
  if (bashResult && !isError) {
    const duration = bashResult.duration ? ` [${(bashResult.duration / 1000).toFixed(1)}s]` : ''
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={getColor('primary')} bold>{'\u2B21 '}</Text>
          <Text color={getColor('primary')} bold>{toolName}</Text>
          {bashResult.exitCode !== 0 && <Text color="red"> (exit {bashResult.exitCode})</Text>}
          <Text dimColor>{duration}</Text>
        </Box>
        {bashResult.stdout.trim() && (
          <Box marginLeft={2} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text>{truncate(bashResult.stdout.trim(), MAX_TOOL_CONTENT)}</Text>
          </Box>
        )}
      </Box>
    )
  }

  // Generic tool result
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={getColor('primary')} bold>{'\u2B21 '}</Text>
        <Text color={getColor('primary')} bold>{toolName}</Text>
        {isError && <Text color="red" bold>{' (error)'}</Text>}
      </Box>
      <Box marginLeft={2}>
        <Text color={isError ? 'red' : 'gray'}>{truncate(content, MAX_TOOL_CONTENT)}</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// MessageRow — dispatches to the right component
// ============================================================================

export const MessageRow: React.FC<{ message: DisplayMessage }> = ({ message }) => {
  const { role, content, toolName, isError, isThinking, timestamp } = message

  switch (role) {
    case 'user':
      return <UserMessage content={content} timestamp={timestamp} />
    case 'assistant':
      return <AssistantMessage content={content} isThinking={isThinking} timestamp={timestamp} />
    case 'system':
      return <SystemMessage content={content} />
    case 'tool_result':
      return <ToolResultMessage toolName={toolName ?? 'tool'} content={content} isError={isError} />
    default:
      return <Text>{content}</Text>
  }
}

// ============================================================================
// MessageDivider
// ============================================================================

export const MessageDivider: React.FC<{ width?: number }> = ({ width = 60 }) => (
  <Box>
    <Text dimColor>{'\u2500'.repeat(Math.min(width, 60))}</Text>
  </Box>
)
