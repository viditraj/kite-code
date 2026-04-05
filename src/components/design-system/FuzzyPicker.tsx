/**
 * FuzzyPicker — Fuzzy search dropdown with text input and filtered list.
 *
 * Features a text input at the top for typing a search query, and a filtered
 * list below. Uses simple substring matching for fuzzy filtering. Supports
 * keyboard navigation (arrow keys, Enter to select, Esc to cancel).
 *
 * @example
 * <FuzzyPicker
 *   items={[
 *     { label: 'File A', value: 'a' },
 *     { label: 'File B', value: 'b', hint: 'modified' },
 *   ]}
 *   onSelect={(item) => console.log('Selected', item.value)}
 *   onCancel={() => console.log('Cancelled')}
 *   placeholder="Search files..."
 * />
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FuzzyPickerItem = {
  label: string
  value: string
  hint?: string
}

export type FuzzyPickerProps = {
  /** Items to display and filter. */
  items: FuzzyPickerItem[]
  /** Called when the user selects an item (Enter). */
  onSelect: (item: FuzzyPickerItem) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Placeholder text shown when the input is empty. */
  placeholder?: string
  /** Whether the picker accepts keyboard input. @default true */
  isActive?: boolean
  /** Maximum number of visible items in the list. @default 8 */
  visibleCount?: number
  /** Colour for focused/active elements. */
  color?: string
}

// ---------------------------------------------------------------------------
// Fuzzy filter — simple substring matching with character-order awareness.
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, text: string): boolean {
  if (query.length === 0) return true
  const lower = text.toLowerCase()
  const q = query.toLowerCase()

  // Character-order fuzzy: every character in the query must appear in order
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      qi++
    }
  }
  return qi === q.length
}

function fuzzyScore(query: string, text: string): number {
  // Lower is better. Exact prefix match wins.
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  if (lower.startsWith(q)) return 0
  if (lower.includes(q)) return 1
  return 2
}

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

function resolveColor(
  color: string | undefined,
  colors: ThemeTokens,
): string | undefined {
  if (!color) return undefined
  if (color in colors) {
    return colors[color]
  }
  return color
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FuzzyPicker({
  items,
  onSelect,
  onCancel,
  placeholder = 'Type to search\u2026',
  isActive = true,
  visibleCount = 8,
  color,
}: FuzzyPickerProps): React.ReactElement {
  const [, colors] = useTheme()
  const resolvedColor = resolveColor(color, colors) ?? colors.primary

  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Filter and sort items
  const filtered = useMemo(() => {
    if (query.length === 0) return items
    return items
      .filter((item) => fuzzyMatch(query, item.label))
      .sort(
        (a, b) =>
          fuzzyScore(query, a.label) - fuzzyScore(query, b.label),
      )
  }, [items, query])

  // Reset focused index when query or items change
  useEffect(() => {
    setFocusedIndex(0)
  }, [query, items])

  // Clamp focused index to valid range
  useEffect(() => {
    if (focusedIndex >= filtered.length) {
      setFocusedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, focusedIndex])

  useInput(
    (input, key) => {
      if (!isActive) return

      // Escape → cancel
      if (key.escape) {
        onCancel()
        return
      }

      // Enter → select
      if (key.return) {
        const item = filtered[focusedIndex]
        if (item) {
          onSelect(item)
        }
        return
      }

      // Arrow navigation
      if (key.upArrow) {
        setFocusedIndex((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.downArrow) {
        setFocusedIndex((prev) => Math.min(filtered.length - 1, prev + 1))
        return
      }

      // Backspace
      if (key.backspace || key.delete) {
        setQuery((prev) => prev.slice(0, -1))
        return
      }

      // Tab is ignored (don't insert)
      if (key.tab) return

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setQuery((prev) => prev + input)
      }
    },
    { isActive },
  )

  // Windowed view
  const windowStart = Math.max(
    0,
    Math.min(
      focusedIndex - Math.floor(visibleCount / 2),
      filtered.length - visibleCount,
    ),
  )
  const visible = filtered.slice(windowStart, windowStart + visibleCount)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={resolvedColor} paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={resolvedColor} bold>
          {'\u276F '}
        </Text>
        <Text>
          {query.length > 0 ? query : ''}
          {query.length === 0 && (
            <Text dimColor>{placeholder}</Text>
          )}
          <Text inverse> </Text>
        </Text>
      </Box>

      {/* Filtered list */}
      {filtered.length === 0 ? (
        <Text dimColor>No matches</Text>
      ) : (
        <Box flexDirection="column">
          {visible.map((item, i) => {
            const actualIndex = windowStart + i
            const isFocused = actualIndex === focusedIndex

            return (
              <Box key={item.value} flexDirection="row">
                <Text color={isFocused ? resolvedColor : undefined}>
                  {isFocused ? '\u276F ' : '  '}
                </Text>
                <Text
                  color={isFocused ? resolvedColor : undefined}
                  bold={isFocused}
                >
                  {item.label}
                </Text>
                {item.hint && (
                  <Text dimColor>
                    {' '}
                    {item.hint}
                  </Text>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      {/* Scroll indicators */}
      {filtered.length > visibleCount && (
        <Box marginTop={0}>
          <Text dimColor>
            {windowStart > 0 ? '\u2191 ' : '  '}
            {filtered.length} items
            {windowStart + visibleCount < filtered.length ? ' \u2193' : ''}
          </Text>
        </Box>
      )}

      {/* Keyboard hints */}
      <Box marginTop={1}>
        <Text dimColor italic>
          \u2191/\u2193 navigate \u00B7 Enter select \u00B7 Esc cancel
        </Text>
      </Box>
    </Box>
  )
}

export default FuzzyPicker
