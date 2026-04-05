/**
 * useHistorySearch — search through command/message history with Ctrl+R.
 *
 * Adapted from Claude Code's useHistorySearch.ts for Kite.
 * Provides incremental search through conversation history with
 * keyboard navigation: Ctrl+R to start/next, Enter to accept, Escape to cancel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useInput } from 'ink'

export interface HistoryEntry {
  /** The full text of the history entry */
  display: string
  /** Optional metadata associated with the entry */
  metadata?: Record<string, unknown>
}

export interface UseHistorySearchOptions {
  /** Full list of history entries (most recent first) */
  history: HistoryEntry[]
  /** Whether the hook should listen for input */
  isActive: boolean
  /** Callback when a history entry is accepted */
  onAccept: (entry: HistoryEntry) => void
  /** Current input value (saved/restored on search start/cancel) */
  currentInput: string
  /** Callback to update the input display */
  onInputChange: (input: string) => void
}

export interface UseHistorySearchResult {
  /** Whether history search mode is active */
  isSearching: boolean
  /** Current search query string */
  historyQuery: string
  /** The currently matched history entry, if any */
  historyMatch: HistoryEntry | undefined
  /** Whether the search found no results */
  historyFailedMatch: boolean
  /** Programmatically start searching */
  startSearch: () => void
  /** Programmatically cancel searching */
  cancelSearch: () => void
  /** Set the search query */
  setHistoryQuery: (query: string) => void
}

export function useHistorySearch(
  options: UseHistorySearchOptions,
): UseHistorySearchResult {
  const { history, isActive, onAccept, currentInput, onInputChange } = options

  const [isSearching, setIsSearching] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFailedMatch, setHistoryFailedMatch] = useState(false)
  const [historyMatch, setHistoryMatch] = useState<HistoryEntry | undefined>(
    undefined,
  )
  const [originalInput, setOriginalInput] = useState('')

  // Index tracking for "next match" cycling
  const matchIndexRef = useRef(0)
  const seenPromptsRef = useRef<Set<string>>(new Set())

  const reset = useCallback(() => {
    setIsSearching(false)
    setHistoryQuery('')
    setHistoryFailedMatch(false)
    setHistoryMatch(undefined)
    setOriginalInput('')
    matchIndexRef.current = 0
    seenPromptsRef.current.clear()
  }, [])

  const startSearch = useCallback(() => {
    setIsSearching(true)
    setOriginalInput(currentInput)
    matchIndexRef.current = 0
    seenPromptsRef.current.clear()
  }, [currentInput])

  const cancelSearch = useCallback(() => {
    onInputChange(originalInput)
    reset()
  }, [onInputChange, originalInput, reset])

  // Search through history when query changes
  const searchHistory = useCallback(
    (resume: boolean) => {
      if (!isSearching || historyQuery.length === 0) {
        if (isSearching) {
          setHistoryMatch(undefined)
          setHistoryFailedMatch(false)
          onInputChange(originalInput)
        }
        return
      }

      const startIdx = resume ? matchIndexRef.current + 1 : 0
      if (!resume) {
        seenPromptsRef.current.clear()
      }

      for (let i = startIdx; i < history.length; i++) {
        const entry = history[i]!
        const text = entry.display
        const lowerText = text.toLowerCase()
        const lowerQuery = historyQuery.toLowerCase()

        if (lowerText.includes(lowerQuery) && !seenPromptsRef.current.has(text)) {
          seenPromptsRef.current.add(text)
          matchIndexRef.current = i
          setHistoryMatch(entry)
          setHistoryFailedMatch(false)
          onInputChange(text)
          return
        }
      }

      // No match found
      setHistoryFailedMatch(true)
    },
    [isSearching, historyQuery, history, onInputChange, originalInput],
  )

  // Re-search when query changes
  useEffect(() => {
    if (isSearching) {
      searchHistory(false)
    }
  }, [historyQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard input during search
  useInput(
    (input, key) => {
      if (!isSearching) {
        // Ctrl+R starts search
        if (key.ctrl && input === 'r') {
          startSearch()
        }
        return
      }

      // Escape cancels search
      if (key.escape) {
        cancelSearch()
        return
      }

      // Enter accepts current match
      if (key.return) {
        if (historyMatch) {
          onAccept(historyMatch)
        }
        reset()
        return
      }

      // Ctrl+R finds next match
      if (key.ctrl && input === 'r') {
        searchHistory(true)
        return
      }

      // Backspace removes last character from query
      if (key.backspace || key.delete) {
        if (historyQuery.length === 0) {
          cancelSearch()
        } else {
          setHistoryQuery(prev => prev.slice(0, -1))
        }
        return
      }

      // Regular characters add to search query
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setHistoryQuery(prev => prev + input)
      }
    },
    { isActive },
  )

  return {
    isSearching,
    historyQuery,
    historyMatch,
    historyFailedMatch,
    startSearch,
    cancelSearch,
    setHistoryQuery,
  }
}
