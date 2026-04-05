/**
 * ThinkingToggle — Simple toggle UI for thinking mode.
 *
 * Shows "Thinking: ON/OFF" with a visual toggle indicator.
 * Enter to toggle, renders inline.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThinkingToggleProps {
  /** Whether thinking mode is currently enabled. */
  enabled: boolean
  /** Called when the user toggles the state. */
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThinkingToggle({
  enabled,
  onToggle,
}: ThinkingToggleProps): React.ReactElement {
  const [focused, setFocused] = useState(false)

  useInput(
    (input, key) => {
      if (key.return) {
        onToggle()
        return
      }
      if (input === ' ') {
        onToggle()
        return
      }
    },
  )

  const toggleIndicator = enabled ? '[\u25CF\u25CB]' : '[\u25CB\u25CF]'
  const statusColor = enabled ? 'green' : 'red'
  const statusText = enabled ? 'ON' : 'OFF'

  return (
    <Box>
      <Text bold>Thinking: </Text>
      <Text color={statusColor} bold>
        {toggleIndicator}
      </Text>
      <Text> </Text>
      <Text color={statusColor} bold>
        {statusText}
      </Text>
      <Text dimColor>{'  (Enter to toggle)'}</Text>
    </Box>
  )
}
