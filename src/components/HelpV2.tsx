/**
 * HelpV2 — Rich help screen with categorized commands.
 *
 * Groups commands by category, shows them as sections with headers.
 * Arrow keys to scroll, Esc to close.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HelpCommand {
  /** Command name (e.g. "/model"). */
  name: string
  /** Human-readable description. */
  description: string
  /** Category for grouping (e.g. "Navigation", "Settings"). */
  category: string
  /** Optional aliases (e.g. ["/m"]). */
  aliases?: string[]
}

export interface HelpV2Props {
  /** Commands to display. */
  commands: HelpCommand[]
  /** Called when the user closes the help screen. */
  onClose: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HelpV2({
  commands,
  onClose,
  isActive = true,
}: HelpV2Props): React.ReactElement {
  const [scrollOffset, setScrollOffset] = useState(0)

  // Group commands by category
  const grouped = useMemo(() => {
    const map = new Map<string, HelpCommand[]>()
    for (const cmd of commands) {
      const existing = map.get(cmd.category) ?? []
      existing.push(cmd)
      map.set(cmd.category, existing)
    }
    return map
  }, [commands])

  // Build flat list of lines for scroll tracking
  const lines = useMemo(() => {
    const result: Array<{
      type: 'header' | 'command'
      category?: string
      command?: HelpCommand
    }> = []
    for (const [category, cmds] of grouped.entries()) {
      result.push({ type: 'header', category })
      for (const cmd of cmds) {
        result.push({ type: 'command', command: cmd })
      }
    }
    return result
  }, [grouped])

  const maxVisible = 20
  const maxScroll = Math.max(0, lines.length - maxVisible)

  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.escape || input === 'q') {
        onClose()
        return
      }

      // Scroll up
      if (key.upArrow || input === 'k') {
        setScrollOffset((prev) => Math.max(0, prev - 1))
        return
      }

      // Scroll down
      if (key.downArrow || input === 'j') {
        setScrollOffset((prev) => Math.min(maxScroll, prev + 1))
        return
      }

      // Page up
      if (key.ctrl && input === 'u') {
        setScrollOffset((prev) => Math.max(0, prev - Math.floor(maxVisible / 2)))
        return
      }

      // Page down
      if (key.ctrl && input === 'd') {
        setScrollOffset((prev) => Math.min(maxScroll, prev + Math.floor(maxVisible / 2)))
        return
      }

      // Home
      if (input === 'g') {
        setScrollOffset(0)
        return
      }

      // End
      if (input === 'G') {
        setScrollOffset(maxScroll)
        return
      }
    },
    { isActive },
  )

  const visibleLines = lines.slice(scrollOffset, scrollOffset + maxVisible)
  const hasMore = scrollOffset + maxVisible < lines.length
  const hasLess = scrollOffset > 0

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box
        marginBottom={1}
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
      >
        <Text color="cyan" bold>
          Kite Help
        </Text>
        <Text dimColor>
          {'  '}
          {commands.length} commands
        </Text>
      </Box>

      {/* Scroll indicator top */}
      {hasLess && (
        <Text dimColor>{'\u2191 scroll up for more'}</Text>
      )}

      {/* Visible items */}
      {visibleLines.map((line, idx) => {
        if (line.type === 'header') {
          return (
            <Box key={`header-${line.category}`} marginTop={idx > 0 ? 1 : 0}>
              <Text color="yellow" bold>
                {'\u2500\u2500 '}
                {line.category}
                {' \u2500\u2500'}
              </Text>
            </Box>
          )
        }

        const cmd = line.command!
        return (
          <Box key={cmd.name}>
            <Text color="cyan" bold>
              {'  '}
              {cmd.name}
            </Text>
            {cmd.aliases && cmd.aliases.length > 0 && (
              <Text dimColor>
                {' ('}
                {cmd.aliases.join(', ')}
                {')'}
              </Text>
            )}
            <Text dimColor>{'  \u2014 '}</Text>
            <Text>{cmd.description}</Text>
          </Box>
        )
      })}

      {/* Scroll indicator bottom */}
      {hasMore && (
        <Text dimColor>{'\u2193 scroll down for more'}</Text>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          {'j/k or \u2191\u2193 to scroll \u00B7 q or Esc to close'}
        </Text>
      </Box>
    </Box>
  )
}
