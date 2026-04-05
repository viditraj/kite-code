/**
 * QuickOpenDialog — File picker with fuzzy filtering.
 *
 * Runs `find` to list files in the cwd, shows a fuzzy-filtered list.
 * Type to filter, arrow keys to navigate, Enter to select, Esc to cancel.
 * Limits to 20 visible items.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickOpenDialogProps {
  /** Current working directory to search in. */
  cwd: string
  /** Called when the user selects a file path. */
  onSelect: (path: string) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 2) return path.slice(-(maxLen - 1))
  // Keep first and last parts, truncate middle
  const first = parts[0]
  const last = parts[parts.length - 1]
  return `${first}/\u2026/${last}`.slice(0, maxLen)
}

/** Simple fuzzy match — checks if query chars appear in order in text. */
function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  let j = 0
  for (let i = 0; i < lower.length && j < qLower.length; i++) {
    if (lower[i] === qLower[j]) j++
  }
  return j === qLower.length
}

/** Score a fuzzy match — lower is better. */
function fuzzyScore(text: string, query: string): number {
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()

  // Exact substring match gets best score
  if (lower.includes(qLower)) return 0

  // Score by distance between matched chars
  let score = 0
  let j = 0
  let lastMatch = -1
  for (let i = 0; i < lower.length && j < qLower.length; i++) {
    if (lower[i] === qLower[j]) {
      if (lastMatch >= 0) score += i - lastMatch
      lastMatch = i
      j++
    }
  }
  return score
}

// ---------------------------------------------------------------------------
// File loader (uses dynamic import for child_process)
// ---------------------------------------------------------------------------

async function loadFiles(cwd: string): Promise<string[]> {
  try {
    const { execSync } = await import('child_process')
    const output = execSync(
      'find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.next/*" 2>/dev/null | head -5000',
      { cwd, encoding: 'utf-8', timeout: 5000 },
    )
    return output
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => l.replace(/^\.\//, ''))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickOpenDialog({
  cwd,
  onSelect,
  onCancel,
  isActive = true,
}: QuickOpenDialogProps): React.ReactElement {
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)

  const maxVisible = 20

  // Load files on mount
  useEffect(() => {
    let cancelled = false
    loadFiles(cwd).then((files) => {
      if (!cancelled) {
        setAllFiles(files)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [cwd])

  // Filter and sort files
  const filtered = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 200)
    return allFiles
      .filter((f) => fuzzyMatch(f, query))
      .sort((a, b) => fuzzyScore(a, query) - fuzzyScore(b, query))
  }, [allFiles, query])

  // Clamp selection
  const clampedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1))

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
        setSelectedIdx((prev) => Math.min(filtered.length - 1, prev + 1))
        return
      }

      // Enter — select
      if (key.return) {
        const file = filtered[clampedIdx]
        if (file) onSelect(file)
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
  const visibleFiles = filtered.slice(scrollStart, scrollStart + maxVisible)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Quick Open
        </Text>
        <Text dimColor>
          {'  (type to filter, \u2191\u2193 navigate, Enter select, Esc cancel)'}
        </Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {'File: '}
        </Text>
        <Text>{before}</Text>
        <Text inverse>{atCursor ?? ' '}</Text>
        <Text>{after}</Text>
        {!loading && (
          <Text dimColor>
            {'  '}({filtered.length} file{filtered.length !== 1 ? 's' : ''})
          </Text>
        )}
      </Box>

      {/* Loading state */}
      {loading && (
        <Text dimColor>Loading files...</Text>
      )}

      {/* No results */}
      {!loading && filtered.length === 0 && query && (
        <Text dimColor>No files match &quot;{query}&quot;</Text>
      )}

      {/* File list */}
      {visibleFiles.map((file, idx) => {
        const absIdx = scrollStart + idx
        const isSelected = absIdx === clampedIdx
        // Get file extension for color
        const ext = file.split('.').pop() ?? ''
        const fileColor =
          ext === 'ts' || ext === 'tsx'
            ? 'blue'
            : ext === 'js' || ext === 'jsx'
              ? 'yellow'
              : ext === 'json'
                ? 'green'
                : ext === 'md'
                  ? 'cyan'
                  : undefined
        return (
          <Box key={file}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text color={isSelected ? fileColor : fileColor} bold={isSelected}>
              {truncatePath(file, 70)}
            </Text>
          </Box>
        )
      })}

      {/* Scroll indicator */}
      {filtered.length > maxVisible && (
        <Text dimColor>
          {'\u2026 '}
          showing {Math.min(maxVisible, filtered.length)} of {filtered.length}{' '}
          files
        </Text>
      )}

      {/* CWD info */}
      <Box marginTop={1}>
        <Text dimColor>cwd: {cwd}</Text>
      </Box>
    </Box>
  )
}
