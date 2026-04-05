/**
 * TokenWarning — Context limit warning banner.
 *
 * Displays a warning bar when context usage exceeds 80%.
 * Yellow at 80%, red at 95%. Shows percentage and token counts.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface TokenWarningProps {
  percentUsed: number
  maxTokens: number
}

// ============================================================================
// Constants
// ============================================================================

const WARNING_THRESHOLD = 80
const ERROR_THRESHOLD = 95

// ============================================================================
// Helpers
// ============================================================================

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return String(count)
}

function buildBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

// ============================================================================
// TokenWarning Component
// ============================================================================

export const TokenWarning: React.FC<TokenWarningProps> = ({
  percentUsed,
  maxTokens,
}) => {
  // Don't show below warning threshold
  if (percentUsed < WARNING_THRESHOLD) {
    return null
  }

  const isError = percentUsed >= ERROR_THRESHOLD
  const color = isError ? 'red' : 'yellow'
  const usedTokens = Math.round((percentUsed / 100) * maxTokens)
  const remainingPercent = Math.max(0, 100 - percentUsed)

  const barWidth = 20
  const bar = buildBar(percentUsed, barWidth)

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color} bold>
          {isError ? '\u26A0 ' : '\u26A1 '}
          Context usage: {Math.round(percentUsed)}%
        </Text>
        <Text dimColor>
          {' '}({formatTokens(usedTokens)} / {formatTokens(maxTokens)} tokens)
        </Text>
      </Box>

      <Box>
        <Text color={color}>{bar}</Text>
        <Text dimColor> {remainingPercent}% remaining</Text>
      </Box>

      {isError && (
        <Box>
          <Text color="red" bold>
            Context nearly full — consider running /compact
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default TokenWarning
