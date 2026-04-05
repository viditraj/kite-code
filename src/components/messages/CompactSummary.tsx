/**
 * CompactSummary — Collapsible text display.
 *
 * Shows first N lines of content, then a dim indicator showing
 * how many additional lines are hidden.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface CompactSummaryProps {
  content: string
  maxLines?: number
  expanded?: boolean
}

// ============================================================================
// CompactSummary Component
// ============================================================================

export const CompactSummary: React.FC<CompactSummaryProps> = ({
  content,
  maxLines = 5,
  expanded = false,
}) => {
  const lines = content.split('\n')
  const totalLines = lines.length

  if (expanded || totalLines <= maxLines) {
    return (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    )
  }

  const visibleLines = lines.slice(0, maxLines)
  const hiddenCount = totalLines - maxLines

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Text dimColor>
        {'... ('}{hiddenCount}{' more line'}{hiddenCount !== 1 ? 's' : ''}{')'} 
      </Text>
    </Box>
  )
}

export default CompactSummary
