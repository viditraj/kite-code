/**
 * MarketplaceSearch — Inline search with live filtering and debounced fetch.
 *
 * A FuzzyPicker-style component tailored for the marketplace. Features a
 * search input at the top, a filtered list of ServerCard rows with windowed
 * scrolling, a result count indicator, and debounced network fetch.
 *
 * @example
 * <MarketplaceSearch
 *   onSelect={(server) => showDetail(server)}
 *   onCancel={() => setView('browse')}
 * />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'
import { ServerCard } from './ServerCard.js'
import type { MarketplaceServer } from '../../services/marketplace/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketplaceSearchProps = {
  /** Called when user presses Enter on a result. */
  onSelect: (server: MarketplaceServer) => void
  /** Called when user presses Esc to go back. */
  onCancel: () => void
  /** Initial query to pre-fill. */
  initialQuery?: string
  /** Whether the component accepts input. @default true */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISIBLE_COUNT = 8
const DEBOUNCE_MS = 400

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketplaceSearch({
  onSelect,
  onCancel,
  initialQuery = '',
  isActive = true,
}: MarketplaceSearchProps): React.ReactElement {
  const colors = getActiveColors()

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<MarketplaceServer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Perform the search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
    setIsLoading(true)
    try {
      const { searchServers } = await import('../../services/marketplace/client.js')
      const servers = await searchServers(q.trim(), { maxResults: 30 })
      setResults(servers)
      setFocusedIndex(0)
      setHasSearched(true)
    } catch {
      setResults([])
      setHasSearched(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search on query change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
    timerRef.current = setTimeout(() => {
      void doSearch(query)
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, doSearch])

  // Keyboard handler
  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.escape) {
        if (query.length > 0) {
          setQuery('')
          setResults([])
          setHasSearched(false)
        } else {
          onCancel()
        }
        return
      }

      if (key.return) {
        const item = results[focusedIndex]
        if (item) onSelect(item)
        return
      }

      if (key.upArrow) {
        setFocusedIndex(prev => Math.max(0, prev - 1))
        return
      }
      if (key.downArrow) {
        setFocusedIndex(prev => Math.min(results.length - 1, prev + 1))
        return
      }

      if (key.backspace || key.delete) {
        setQuery(prev => prev.slice(0, -1))
        return
      }

      if (key.tab) return

      if (input && !key.ctrl && !key.meta) {
        setQuery(prev => prev + input)
      }
    },
    { isActive },
  )

  // Windowed view
  const windowStart = Math.max(
    0,
    Math.min(
      focusedIndex - Math.floor(VISIBLE_COUNT / 2),
      results.length - VISIBLE_COUNT,
    ),
  )
  const visible = results.slice(windowStart, windowStart + VISIBLE_COUNT)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'\u276F '}</Text>
        <Text>
          {query.length > 0 ? query : ''}
          {query.length === 0 && (
            <Text dimColor>Search MCP servers...</Text>
          )}
          <Text inverse>{' '}</Text>
        </Text>
        {isLoading && (
          <Text color={colors.warning}>{' \u27F3 searching...'}</Text>
        )}
      </Box>

      {/* Results */}
      {results.length === 0 && hasSearched && !isLoading ? (
        <Text dimColor>No results found. Try different keywords.</Text>
      ) : results.length === 0 && !hasSearched ? (
        <Text dimColor>Type at least 2 characters to search.</Text>
      ) : (
        <Box flexDirection="column">
          {visible.map((server, i) => {
            const actualIndex = windowStart + i
            return (
              <Box key={server.path} marginBottom={actualIndex < windowStart + visible.length - 1 ? 1 : 0}>
                <ServerCard
                  name={server.name}
                  description={server.description}
                  path={server.path}
                  isOfficial={server.isOfficial}
                  isFocused={actualIndex === focusedIndex}
                />
              </Box>
            )
          })}
        </Box>
      )}

      {/* Scroll indicators & count */}
      {results.length > VISIBLE_COUNT && (
        <Box marginTop={0}>
          <Text dimColor>
            {windowStart > 0 ? '\u2191 ' : '  '}
            {results.length} results
            {windowStart + VISIBLE_COUNT < results.length ? ' \u2193' : ''}
          </Text>
        </Box>
      )}

      {/* Hints */}
      <Box marginTop={1} flexDirection="row" gap={2}>
        <Box>
          <Text inverse bold>{' \u2191\u2193 '}</Text>
          <Text dimColor> navigate</Text>
        </Box>
        <Box>
          <Text inverse bold>{' Enter '}</Text>
          <Text dimColor> select</Text>
        </Box>
        <Box>
          <Text inverse bold>{' Esc '}</Text>
          <Text dimColor> back</Text>
        </Box>
      </Box>
    </Box>
  )
}

export default MarketplaceSearch
