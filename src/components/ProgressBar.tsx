/**
 * ProgressBar — Horizontal progress indicator.
 *
 * Renders a bar filled with █ and ░ characters, an optional label
 * on the left, and the numeric percentage on the right.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressBarProps {
  /** Progress percentage (0-100). Clamped internally. */
  percent: number
  /** Total width of the bar in columns. Defaults to 40. */
  width?: number
  /** Optional label shown before the bar. */
  label?: string
  /** Colour for the filled portion. Defaults to 'green'. */
  color?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({
  percent,
  width = 40,
  label,
  color = 'green',
}: ProgressBarProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, percent))
  const filledWidth = Math.round((clamped / 100) * width)
  const emptyWidth = width - filledWidth

  const filled = '\u2588'.repeat(filledWidth)   // █
  const empty = '\u2591'.repeat(emptyWidth)      // ░

  const percentText = `${Math.round(clamped)}%`

  return (
    <Box>
      {label && (
        <Text>
          {label}{' '}
        </Text>
      )}
      <Text color={color}>{filled}</Text>
      <Text dimColor>{empty}</Text>
      <Text> {percentText}</Text>
    </Box>
  )
}
