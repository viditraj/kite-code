/**
 * OutputStylePicker — Output verbosity selector.
 *
 * Three options (concise / normal / verbose) with descriptions.
 * Arrow keys + Enter to choose.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutputStyle = 'concise' | 'normal' | 'verbose'

export interface OutputStylePickerProps {
  /** Currently active output style. */
  current: OutputStyle
  /** Called when the user selects a style. */
  onSelect: (style: OutputStyle) => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Style metadata
// ---------------------------------------------------------------------------

interface StyleMeta {
  style: OutputStyle
  label: string
  description: string
  symbol: string
  color: string
}

const STYLES: StyleMeta[] = [
  {
    style: 'concise',
    label: 'Concise',
    description: 'Brief, to-the-point responses',
    symbol: '\u25AB',
    color: 'green',
  },
  {
    style: 'normal',
    label: 'Normal',
    description: 'Balanced detail and brevity (default)',
    symbol: '\u25A0',
    color: 'cyan',
  },
  {
    style: 'verbose',
    label: 'Verbose',
    description: 'Detailed explanations and context',
    symbol: '\u25AC',
    color: 'yellow',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutputStylePicker({
  current,
  onSelect,
  isActive = true,
}: OutputStylePickerProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = STYLES.findIndex((s) => s.style === current)
    return idx >= 0 ? idx : 1
  })

  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.upArrow) {
        setSelectedIdx((prev) => (prev - 1 + STYLES.length) % STYLES.length)
        return
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => (prev + 1) % STYLES.length)
        return
      }
      if (key.return) {
        const meta = STYLES[selectedIdx]
        if (meta) onSelect(meta.style)
        return
      }

      // Left/Right arrows for quick adjustment
      if (key.leftArrow) {
        setSelectedIdx((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.rightArrow) {
        setSelectedIdx((prev) => Math.min(STYLES.length - 1, prev + 1))
        return
      }

      // Number keys for quick select
      const num = parseInt(input, 10)
      if (num >= 1 && num <= STYLES.length) {
        const meta = STYLES[num - 1]
        if (meta) onSelect(meta.style)
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
          Output Style
        </Text>
        <Text dimColor>
          {'  (\u2191\u2193 navigate, Enter select)'}
        </Text>
      </Box>

      {/* Verbosity slider visualization */}
      <Box marginBottom={1}>
        {STYLES.map((meta, idx) => (
          <Box key={meta.style}>
            <Text color={idx <= selectedIdx ? meta.color : 'gray'}>
              {meta.symbol}
            </Text>
            {idx < STYLES.length - 1 && (
              <Text color="gray">{'\u2500'}</Text>
            )}
          </Box>
        ))}
        <Text>{'  '}</Text>
        <Text color={STYLES[selectedIdx]?.color}>
          {STYLES[selectedIdx]?.label}
        </Text>
      </Box>

      {/* Options */}
      {STYLES.map((meta, idx) => {
        const isSelected = idx === selectedIdx
        const isCurrent = meta.style === current
        return (
          <Box key={meta.style}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text dimColor>{`${idx + 1}. `}</Text>
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

      {/* Description for selected */}
      <Box marginTop={1}>
        <Text dimColor>
          This changes how detailed the AI&apos;s responses will be.
        </Text>
      </Box>
    </Box>
  )
}
