/**
 * InterruptedByUser — Cancellation message display.
 *
 * Shows a lightning bolt icon with "Request cancelled" in yellow,
 * with an optional reason.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface InterruptedByUserProps {
  reason?: string
}

// ============================================================================
// InterruptedByUser Component
// ============================================================================

export const InterruptedByUser: React.FC<InterruptedByUserProps> = ({ reason }) => {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="yellow" bold>{'\u26A1 Request cancelled'}</Text>
      </Box>
      {reason && (
        <Box marginLeft={2}>
          <Text color="yellow" dimColor>{reason}</Text>
        </Box>
      )}
    </Box>
  )
}

export default InterruptedByUser
