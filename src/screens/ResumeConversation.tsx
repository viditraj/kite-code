/**
 * ResumeConversation — Session resume screen.
 *
 * Implements the same pattern as Claude Code's ResumeConversation.tsx:
 * - Lists recent sessions with titles and dates
 * - Arrow key navigation to select a session
 * - Enter to resume, Escape to cancel
 * - Loads session messages and restores conversation state
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Text, useInput, useApp } from 'ink'

import {
  listSessions,
  loadSession,
  type SessionMetadata,
  type SavedSession,
} from '../utils/session.js'
import type { UnifiedMessage } from '../providers/types.js'

// ============================================================================
// Types
// ============================================================================

export interface ResumeConversationProps {
  onResume: (messages: UnifiedMessage[], metadata: SessionMetadata) => void
  onCancel: () => void
  initialQuery?: string
  sessionId?: string
}

// ============================================================================
// ResumeConversation Component
// ============================================================================

export const ResumeConversation: React.FC<ResumeConversationProps> = ({
  onResume,
  onCancel,
  initialQuery,
  sessionId: directSessionId,
}) => {
  const { exit } = useApp()
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)

  // Load sessions on mount
  useEffect(() => {
    try {
      // If a direct session ID was provided, try to load it immediately
      if (directSessionId) {
        const session = loadSession(directSessionId)
        if (session) {
          onResume(session.messages, session.metadata)
          return
        }
        setError(`Session not found: ${directSessionId}`)
      }

      const allSessions = listSessions(20)
      setSessions(allSessions)

      // If an initial query was provided, filter sessions
      if (initialQuery && allSessions.length > 0) {
        const query = initialQuery.toLowerCase()
        const matchIndex = allSessions.findIndex(s =>
          s.title.toLowerCase().includes(query) ||
          s.id.includes(query),
        )
        if (matchIndex >= 0) {
          setSelectedIndex(matchIndex)
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [directSessionId, initialQuery, onResume])

  // Handle keyboard input
  useInput((input, key) => {
    if (resuming) return

    // Escape to cancel
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel()
      return
    }

    // Arrow keys to navigate
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(sessions.length - 1, prev + 1))
      return
    }

    // Enter to resume selected session
    if (key.return && sessions.length > 0) {
      const selected = sessions[selectedIndex]
      if (selected) {
        setResuming(true)
        try {
          const session = loadSession(selected.id)
          if (session) {
            onResume(session.messages, session.metadata)
          } else {
            setError(`Failed to load session: ${selected.id}`)
            setResuming(false)
          }
        } catch (err) {
          setError((err as Error).message)
          setResuming(false)
        }
      }
      return
    }

    // q to quit
    if (input === 'q') {
      onCancel()
      return
    }
  })

  // Format date for display
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="yellow">Loading sessions...</Text>
      </Box>
    )
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press Escape to go back</Text>
      </Box>
    )
  }

  // Resuming state
  if (resuming) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="cyan">Resuming session...</Text>
      </Box>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold>Resume Conversation</Text>
        <Box marginTop={1}>
          <Text dimColor>No saved sessions found.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Escape to go back</Text>
        </Box>
      </Box>
    )
  }

  // Session list
  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Resume Conversation</Text>
        <Text dimColor> ({sessions.length} sessions)</Text>
      </Box>

      {/* Session list */}
      <Box flexDirection="column">
        {sessions.map((session, index) => {
          const isSelected = index === selectedIndex
          return (
            <Box key={session.id} marginBottom={0}>
              <Text
                color={isSelected ? 'cyan' : undefined}
                bold={isSelected}
              >
                {isSelected ? '❯ ' : '  '}
              </Text>
              <Text
                color={isSelected ? 'cyan' : undefined}
                bold={isSelected}
              >
                {session.title.slice(0, 50)}
              </Text>
              <Text dimColor>
                {' '}({session.messageCount} msgs, {formatDate(session.updatedAt)})
              </Text>
            </Box>
          )
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate • Enter to resume • Esc to cancel</Text>
      </Box>

      {/* Selected session details */}
      {sessions[selectedIndex] && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            ID: {sessions[selectedIndex]!.id} • Model: {sessions[selectedIndex]!.model} • CWD: {sessions[selectedIndex]!.cwd}
          </Text>
        </Box>
      )}
    </Box>
  )
}
