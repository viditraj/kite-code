/**
 * SessionPicker — interactive session selection screen.
 *
 * Shown when the user runs `kite -r` (resume) without a session ID.
 * Lists recent sessions with fuzzy search, matching Claude Code's
 * ResumeConversation → LogSelector pattern.
 *
 * Features:
 * - Lists recent sessions sorted by date
 * - Arrow key navigation
 * - Fuzzy search filtering (type to filter)
 * - Shows session title, date, model, message count
 * - Enter to select, Esc/Ctrl+C to cancel
 */

import React, { useState, useMemo } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { listSessions, type SessionMetadata } from '../utils/session.js'

// ============================================================================
// Types
// ============================================================================

export interface SessionPickerProps {
  /** Callback when a session is selected */
  onSelect: (session: SessionMetadata) => void
  /** Callback when the user cancels (Esc / Ctrl+C) */
  onCancel: () => void
  /** Optional initial search query (from `kite -r <search>`) */
  initialSearchQuery?: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '\u2026' : str
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

// ============================================================================
// SessionPicker Component
// ============================================================================

export const SessionPicker: React.FC<SessionPickerProps> = ({
  onSelect,
  onCancel,
  initialSearchQuery = '',
}) => {
  const { exit } = useApp()
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Load all sessions on mount
  const allSessions = useMemo(() => listSessions(50), [])

  // Filter by search query
  const sessions = useMemo(() => {
    if (!searchQuery) return allSessions
    return allSessions.filter(
      s =>
        fuzzyMatch(s.title, searchQuery) ||
        fuzzyMatch(s.id, searchQuery) ||
        fuzzyMatch(s.model, searchQuery),
    )
  }, [allSessions, searchQuery])

  // Clamp index
  const clampedIndex = Math.min(selectedIndex, Math.max(0, sessions.length - 1))

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }
    if (key.ctrl && input === 'c') {
      onCancel()
      exit()
      return
    }
    if (key.return) {
      if (sessions.length > 0 && sessions[clampedIndex]) {
        onSelect(sessions[clampedIndex])
      }
      return
    }
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(sessions.length - 1, prev + 1))
      return
    }
    if (key.backspace || key.delete) {
      setSearchQuery(prev => prev.slice(0, -1))
      setSelectedIndex(0)
      return
    }
    // Regular character input for search
    if (input && !key.ctrl && !key.meta) {
      setSearchQuery(prev => prev + input)
      setSelectedIndex(0)
    }
  })

  // No sessions at all
  if (allSessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>No conversations found to resume.</Text>
        <Text dimColor>Start a new conversation by running: kite</Text>
      </Box>
    )
  }

  const PAGE_SIZE = Math.min(15, sessions.length)
  // Compute visible window around the selected index
  const halfPage = Math.floor(PAGE_SIZE / 2)
  let startIdx = Math.max(0, clampedIndex - halfPage)
  const endIdx = Math.min(sessions.length, startIdx + PAGE_SIZE)
  if (endIdx - startIdx < PAGE_SIZE) {
    startIdx = Math.max(0, endIdx - PAGE_SIZE)
  }
  const visibleSessions = sessions.slice(startIdx, endIdx)

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Resume a conversation</Text>
      </Box>

      {/* Search */}
      <Box marginBottom={1}>
        <Text dimColor>Search: </Text>
        {searchQuery ? (
          <Text>{searchQuery}<Text inverse> </Text></Text>
        ) : (
          <Text dimColor>Type to filter...<Text inverse> </Text></Text>
        )}
        <Text dimColor>  ({sessions.length} of {allSessions.length})</Text>
      </Box>

      {/* Session list */}
      {sessions.length === 0 ? (
        <Box paddingY={1}>
          <Text dimColor>No sessions match &quot;{searchQuery}&quot;</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {visibleSessions.map((session, i) => {
            const absoluteIndex = startIdx + i
            const isSelected = absoluteIndex === clampedIndex
            return (
              <Box key={session.id} paddingX={1}>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {isSelected ? '\u276f ' : '  '}
                </Text>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {truncate(session.title, 50).padEnd(50)}
                </Text>
                <Text dimColor>
                  {' '}{formatRelativeTime(session.updatedAt).padEnd(8)}
                </Text>
                <Text dimColor>
                  {' '}{session.model.padEnd(25)}
                </Text>
                <Text dimColor>
                  {' '}{session.id}
                </Text>
              </Box>
            )
          })}
          {sessions.length > PAGE_SIZE && (
            <Box marginTop={1}>
              <Text dimColor>
                Showing {startIdx + 1}-{endIdx} of {sessions.length}
                {startIdx > 0 ? ' \u2191' : ''}
                {endIdx < sessions.length ? ' \u2193' : ''}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          {'\u2191\u2193 navigate  Enter select  Esc cancel  Type to search'}
        </Text>
      </Box>
    </Box>
  )
}
