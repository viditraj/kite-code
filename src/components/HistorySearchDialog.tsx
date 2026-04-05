/**
 * HistorySearchDialog — Search conversation messages.
 *
 * Text input for search query, filtered list of matching messages below.
 * Arrow keys to navigate results, Enter to select, Esc to cancel.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryMessage {
  role: string
  content: string
}

export interface HistorySearchDialogProps {
  /** All messages to search through. */
  messages: HistoryMessage[]
  /** Called when the user selects a message by index. */
  onSelect: (index: number) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  const clean = text.replace(/\n/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  return clean.slice(0, maxLen - 1) + '\u2026'
}

function highlight(text: string, query: string): React.ReactElement {
  if (!query) return <Text>{text}</Text>

  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)

  if (idx < 0) return <Text>{text}</Text>

  return (
    <Text>
      {text.slice(0, idx)}
      <Text color="yellow" bold>
        {text.slice(idx, idx + query.length)}
      </Text>
      {text.slice(idx + query.length)}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HistorySearchDialog({
  messages,
  onSelect,
  onCancel,
  isActive = true,
}: HistorySearchDialogProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)

  const maxVisible = 15

  // Filter messages by query
  const results = useMemo(() => {
    if (!query.trim()) return messages.map((m, i) => ({ msg: m, origIdx: i }))
    const lower = query.toLowerCase()
    return messages
      .map((m, i) => ({ msg: m, origIdx: i }))
      .filter(({ msg }) => msg.content.toLowerCase().includes(lower))
  }, [messages, query])

  // Clamp selection
  const clampedIdx = Math.min(selectedIdx, Math.max(0, results.length - 1))

  useInput(
    (input, key) => {
      if (!isActive) return

      // Escape — cancel
      if (key.escape) {
        if (query) {
          setQuery('')
          setCursorPos(0)
          setSelectedIdx(0)
        } else {
          onCancel()
        }
        return
      }

      // Arrow navigation for results
      if (key.upArrow) {
        setSelectedIdx((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => Math.min(results.length - 1, prev + 1))
        return
      }

      // Enter — select
      if (key.return) {
        const result = results[clampedIdx]
        if (result) onSelect(result.origIdx)
        return
      }

      // Backspace
      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setQuery((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos))
          setCursorPos((prev) => prev - 1)
          setSelectedIdx(0)
        }
        return
      }

      // Left/Right cursor
      if (key.leftArrow) {
        setCursorPos((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.rightArrow) {
        setCursorPos((prev) => Math.min(query.length, prev + 1))
        return
      }

      // Ctrl+U — clear
      if (key.ctrl && input === 'u') {
        setQuery('')
        setCursorPos(0)
        setSelectedIdx(0)
        return
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setQuery((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos))
        setCursorPos((prev) => prev + input.length)
        setSelectedIdx(0)
      }
    },
    { isActive },
  )

  // Render query with cursor
  const before = query.slice(0, cursorPos)
  const atCursor = cursorPos < query.length ? query[cursorPos] : undefined
  const after = cursorPos < query.length ? query.slice(cursorPos + 1) : ''

  // Visible window of results
  const scrollStart = Math.max(0, clampedIdx - Math.floor(maxVisible / 2))
  const visibleResults = results.slice(scrollStart, scrollStart + maxVisible)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Search Messages
        </Text>
        <Text dimColor>
          {'  (\u2191\u2193 navigate, Enter select, Esc cancel)'}
        </Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {'Search: '}
        </Text>
        <Text>{before}</Text>
        <Text inverse>{atCursor ?? ' '}</Text>
        <Text>{after}</Text>
        <Text dimColor>
          {'  '}({results.length} result{results.length !== 1 ? 's' : ''})
        </Text>
      </Box>

      {/* Results */}
      {results.length === 0 && query && (
        <Text dimColor>No messages match &quot;{query}&quot;</Text>
      )}

      {visibleResults.map((result, idx) => {
        const absIdx = scrollStart + idx
        const isSelected = absIdx === clampedIdx
        const roleColor = result.msg.role === 'user' ? 'blue' : 'green'
        const preview = truncate(result.msg.content, 60)
        return (
          <Box key={result.origIdx}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text color={roleColor} bold>
              [{result.msg.role}]
            </Text>
            <Text> </Text>
            {query ? (
              highlight(preview, query)
            ) : (
              <Text dimColor>{preview}</Text>
            )}
          </Box>
        )
      })}

      {/* Scroll indicator */}
      {results.length > maxVisible && (
        <Text dimColor>
          {'\u2026 '}
          {results.length - maxVisible} more result
          {results.length - maxVisible !== 1 ? 's' : ''}
        </Text>
      )}
    </Box>
  )
}
