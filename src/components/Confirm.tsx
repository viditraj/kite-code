/**
 * Confirm — Yes / No confirmation dialog.
 *
 * Waits for the user to press 'y' or 'n' and fires the appropriate
 * callback.  Displays a message with a [Y/n] indicator.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmProps {
  /** The question / message to display. */
  message: string
  /** Called when the user confirms (presses 'y' or 'Y'). */
  onConfirm: () => void
  /** Called when the user cancels (presses 'n', 'N', or Escape). */
  onCancel: () => void
  /** Whether this component is active for keyboard input. Defaults to true. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Confirm({
  message,
  onConfirm,
  onCancel,
  isActive = true,
}: ConfirmProps): React.ReactElement {
  const [answered, setAnswered] = useState(false)
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null)

  useInput(
    (input, key) => {
      if (answered) return

      if (input === 'y' || input === 'Y') {
        setAnswered(true)
        setChoice('yes')
        onConfirm()
        return
      }

      if (input === 'n' || input === 'N' || key.escape) {
        setAnswered(true)
        setChoice('no')
        onCancel()
        return
      }
    },
    { isActive: isActive && !answered },
  )

  return (
    <Box>
      <Text color="yellow" bold>
        {'? '}
      </Text>
      <Text>{message} </Text>

      {!answered ? (
        <Text dimColor>[Y/n]</Text>
      ) : choice === 'yes' ? (
        <Text color="green" bold>Yes</Text>
      ) : (
        <Text color="red" bold>No</Text>
      )}
    </Box>
  )
}
