/**
 * EffortCallout — Effort level selector.
 *
 * Presents three effort levels (low, medium, high) with descriptions.
 * Arrow keys + Enter to choose, inspired by Claude Code's effort picker.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EffortLevel = 'low' | 'medium' | 'high'

export interface EffortCalloutProps {
  /** Currently selected effort level. */
  current: EffortLevel
  /** Called when the user selects a level. */
  onSelect: (level: EffortLevel) => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Level metadata
// ---------------------------------------------------------------------------

interface LevelMeta {
  level: EffortLevel
  label: string
  description: string
  symbol: string
  color: string
}

const LEVELS: LevelMeta[] = [
  {
    level: 'low',
    label: 'Low',
    description: 'Fast, less thorough — quick answers',
    symbol: '\u25CB',
    color: 'green',
  },
  {
    level: 'medium',
    label: 'Medium',
    description: 'Balanced speed and quality',
    symbol: '\u25D1',
    color: 'yellow',
  },
  {
    level: 'high',
    label: 'High',
    description: 'Slower, more thorough — deeper analysis',
    symbol: '\u25CF',
    color: 'red',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EffortCallout({
  current,
  onSelect,
  isActive = true,
}: EffortCalloutProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = LEVELS.findIndex((l) => l.level === current)
    return idx >= 0 ? idx : 1
  })

  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.upArrow) {
        setSelectedIdx((prev) => (prev - 1 + LEVELS.length) % LEVELS.length)
        return
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => (prev + 1) % LEVELS.length)
        return
      }
      if (key.return) {
        const meta = LEVELS[selectedIdx]
        if (meta) onSelect(meta.level)
        return
      }

      // Left/Right arrows to adjust effort level
      if (key.leftArrow) {
        setSelectedIdx((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.rightArrow) {
        setSelectedIdx((prev) => Math.min(LEVELS.length - 1, prev + 1))
        return
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Effort Level
        </Text>
        <Text dimColor>
          {'  (\u2191\u2193 navigate, \u2190\u2192 adjust, Enter select)'}
        </Text>
      </Box>

      {/* Effort level bar visualization */}
      <Box marginBottom={1}>
        {LEVELS.map((meta, idx) => (
          <Box key={meta.level}>
            <Text color={idx <= selectedIdx ? meta.color : 'gray'}>
              {meta.symbol}
            </Text>
            {idx < LEVELS.length - 1 && (
              <Text color={idx < selectedIdx ? 'gray' : 'gray'}>
                {'\u2500'}
              </Text>
            )}
          </Box>
        ))}
        <Text>
          {'  '}
          {LEVELS[selectedIdx]?.label ?? ''}
        </Text>
      </Box>

      {/* Options */}
      {LEVELS.map((meta, idx) => {
        const isSelected = idx === selectedIdx
        const isCurrent = meta.level === current
        return (
          <Box key={meta.level}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text color={meta.color}>{meta.symbol} </Text>
            <Text
              color={isSelected ? meta.color : undefined}
              bold={isSelected}
            >
              {meta.label}
            </Text>
            {isCurrent && <Text color="green">{' (current)'}</Text>}
            <Text dimColor>{`  ${meta.description}`}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
