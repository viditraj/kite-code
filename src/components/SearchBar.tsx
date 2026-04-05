/**
 * SearchBar — Inline search input with match count display.
 *
 * Renders "Search: ___  (N/M matches)" with keyboard navigation:
 *   - Typing updates the query
 *   - Enter fires the search callback
 *   - n / N navigate between matches (when not typing)
 *   - Escape closes the search bar
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  /** Called when the user presses Enter to execute a search. */
  onSearch: (query: string) => void
  /** Called when the user presses Escape to dismiss the bar. */
  onClose: () => void
  /** Total number of matches for the current query. */
  matchCount?: number
  /** 1-based index of the currently highlighted match. */
  currentMatch?: number
  /** Whether this component receives keyboard input. Defaults to true. */
  isActive?: boolean
  /** Called when the user presses 'n' to go to the next match. */
  onNextMatch?: () => void
  /** Called when the user presses 'N' to go to the previous match. */
  onPrevMatch?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchBar({
  onSearch,
  onClose,
  matchCount,
  currentMatch,
  isActive = true,
  onNextMatch,
  onPrevMatch,
}: SearchBarProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const reset = useCallback(() => {
    setQuery('')
    setCursorPos(0)
    setSubmitted(false)
  }, [])

  useInput(
    (input, key) => {
      // ---- Escape — close bar ----
      if (key.escape) {
        reset()
        onClose()
        return
      }

      // ---- After submission, n/N navigate matches ----
      if (submitted) {
        if (input === 'n') {
          onNextMatch?.()
          return
        }
        if (input === 'N') {
          onPrevMatch?.()
          return
        }
        // Any other key re-enters editing mode
        setSubmitted(false)
        // Fall through to normal input handling below
      }

      // ---- Enter — execute search ----
      if (key.return) {
        if (query.length > 0) {
          setSubmitted(true)
          onSearch(query)
        }
        return
      }

      // ---- Backspace ----
      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setQuery((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos))
          setCursorPos((prev) => prev - 1)
        }
        return
      }

      // ---- Left / Right arrows ----
      if (key.leftArrow) {
        setCursorPos((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.rightArrow) {
        setCursorPos((prev) => Math.min(query.length, prev + 1))
        return
      }

      // ---- Ctrl+U — clear query ----
      if (key.ctrl && input === 'u') {
        setQuery('')
        setCursorPos(0)
        return
      }

      // ---- Regular character input ----
      if (input && !key.ctrl && !key.meta) {
        setQuery((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos))
        setCursorPos((prev) => prev + input.length)
      }
    },
    { isActive },
  )

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // Render query with a visible cursor
  const before = query.slice(0, cursorPos)
  const atCursor = cursorPos < query.length ? query[cursorPos] : undefined
  const after = cursorPos < query.length ? query.slice(cursorPos + 1) : ''

  const hasMatches = matchCount !== undefined
  const matchInfo =
    hasMatches && currentMatch !== undefined
      ? `(${currentMatch}/${matchCount} matches)`
      : hasMatches
        ? `(${matchCount} matches)`
        : ''

  return (
    <Box>
      <Text color="cyan" bold>
        {'Search: '}
      </Text>

      {/* Query text with cursor */}
      <Text>
        {before}
      </Text>
      {isActive ? (
        <Text inverse>{atCursor ?? ' '}</Text>
      ) : (
        <Text>{atCursor ?? ''}</Text>
      )}
      <Text>{after}</Text>

      {/* Match count */}
      {matchInfo && (
        <Text dimColor>{'  '}{matchInfo}</Text>
      )}

      {/* Navigation hint */}
      {submitted && (
        <Text dimColor>{'  [n/N navigate, Esc close]'}</Text>
      )}
    </Box>
  )
}
