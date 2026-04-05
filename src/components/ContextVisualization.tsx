/**
 * ContextVisualization — Token usage display with segmented progress bar.
 *
 * Shows a horizontal bar with color segments for input (cyan)
 * and output (green) tokens, plus percentage label. Inspired by
 * Claude Code's ContextVisualization but simplified for Kite.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextVisualizationProps {
  /** Total tokens used so far. */
  usedTokens: number
  /** Maximum tokens in the context window. */
  maxTokens: number
  /** Tokens consumed by input/prompt. */
  inputTokens: number
  /** Tokens consumed by output/response. */
  outputTokens: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextVisualization({
  usedTokens,
  maxTokens,
  inputTokens,
  outputTokens,
}: ContextVisualizationProps): React.ReactElement {
  const barWidth = 40
  const totalPercent = maxTokens > 0 ? clamp((usedTokens / maxTokens) * 100, 0, 100) : 0

  // Calculate proportional widths for each segment
  const inputPercent = maxTokens > 0 ? (inputTokens / maxTokens) * 100 : 0
  const outputPercent = maxTokens > 0 ? (outputTokens / maxTokens) * 100 : 0

  const inputWidth = Math.round((inputPercent / 100) * barWidth)
  const outputWidth = Math.round((outputPercent / 100) * barWidth)
  const freeWidth = Math.max(0, barWidth - inputWidth - outputWidth)

  const inputBar = '\u2588'.repeat(inputWidth)   // █ in cyan
  const outputBar = '\u2588'.repeat(outputWidth)  // █ in green
  const freeBar = '\u2591'.repeat(freeWidth)      // ░ dimmed

  const percentText = `${Math.round(totalPercent)}%`

  // Determine color based on usage
  const usageColor =
    totalPercent >= 90 ? 'red' : totalPercent >= 70 ? 'yellow' : 'green'

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>Context Usage</Text>
        <Text dimColor>
          {'  '}
          {formatTokens(usedTokens)} / {formatTokens(maxTokens)} tokens
        </Text>
      </Box>

      {/* Segmented bar */}
      <Box>
        <Text>{'['}</Text>
        <Text color="cyan">{inputBar}</Text>
        <Text color="green">{outputBar}</Text>
        <Text dimColor>{freeBar}</Text>
        <Text>{'] '}</Text>
        <Text color={usageColor} bold>
          {percentText}
        </Text>
      </Box>

      {/* Legend */}
      <Box marginTop={1}>
        <Text color="cyan">{'\u2588'}</Text>
        <Text>{' Input: '}</Text>
        <Text dimColor>
          {formatTokens(inputTokens)} ({Math.round(inputPercent)}%)
        </Text>
        <Text>{'  '}</Text>
        <Text color="green">{'\u2588'}</Text>
        <Text>{' Output: '}</Text>
        <Text dimColor>
          {formatTokens(outputTokens)} ({Math.round(outputPercent)}%)
        </Text>
        <Text>{'  '}</Text>
        <Text dimColor>
          {'\u2591'}
          {' Free: '}
          {formatTokens(Math.max(0, maxTokens - usedTokens))} (
          {Math.round(Math.max(0, 100 - totalPercent))}%)
        </Text>
      </Box>
    </Box>
  )
}
