/**
 * CostThresholdDialog — Budget alert dialog.
 *
 * Shows the current session cost vs the maximum budget, with a warning
 * and continue/stop buttons. Arrow keys + Enter to choose.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostThresholdDialogProps {
  /** Current session cost in dollars. */
  currentCost: number
  /** Maximum cost threshold in dollars. */
  maxCost: number
  /** Called when the user chooses to continue. */
  onContinue: () => void
  /** Called when the user chooses to stop. */
  onStop: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostThresholdDialog({
  currentCost,
  maxCost,
  onContinue,
  onStop,
  isActive = true,
}: CostThresholdDialogProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(0)

  const options = [
    { label: 'Continue', action: onContinue, color: 'green' as const },
    { label: 'Stop', action: onStop, color: 'red' as const },
  ]

  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.escape) {
        onStop()
        return
      }

      if (key.upArrow || key.leftArrow) {
        setSelectedIdx((prev) => (prev - 1 + options.length) % options.length)
        return
      }
      if (key.downArrow || key.rightArrow) {
        setSelectedIdx((prev) => (prev + 1) % options.length)
        return
      }
      if (key.return) {
        const opt = options[selectedIdx]
        if (opt) opt.action()
        return
      }

      // 'c' for continue, 's' for stop
      if (input === 'c') {
        onContinue()
        return
      }
      if (input === 's') {
        onStop()
        return
      }
    },
    { isActive },
  )

  const costPercent = maxCost > 0 ? (currentCost / maxCost) * 100 : 0
  const barWidth = 30
  const filledWidth = Math.round((Math.min(costPercent, 100) / 100) * barWidth)
  const emptyWidth = barWidth - filledWidth

  const barColor = costPercent >= 100 ? 'red' : costPercent >= 80 ? 'yellow' : 'green'
  const filled = '\u2588'.repeat(filledWidth)
  const empty = '\u2591'.repeat(emptyWidth)

  return (
    <Box flexDirection="column">
      {/* Warning header */}
      <Box
        marginBottom={1}
        borderStyle="single"
        borderColor="yellow"
        paddingX={1}
      >
        <Text color="yellow" bold>
          {'\u26A0'} Budget Alert
        </Text>
      </Box>

      {/* Cost display */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text>Session cost: </Text>
          <Text color={barColor} bold>
            ${currentCost.toFixed(2)}
          </Text>
          <Text> / </Text>
          <Text bold>${maxCost.toFixed(2)}</Text>
        </Box>

        {/* Cost progress bar */}
        <Box>
          <Text>{'['}</Text>
          <Text color={barColor}>{filled}</Text>
          <Text dimColor>{empty}</Text>
          <Text>{'] '}</Text>
          <Text color={barColor}>{Math.round(costPercent)}%</Text>
        </Box>
      </Box>

      {/* Warning message */}
      {costPercent >= 100 ? (
        <Box marginBottom={1}>
          <Text color="red" bold>
            You have exceeded your session budget!
          </Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color="yellow">
            You are approaching your session budget limit.
          </Text>
        </Box>
      )}

      {/* Action buttons */}
      <Box marginBottom={1}>
        <Text dimColor>
          {'(\u2191\u2193 navigate, Enter select, c=continue, s=stop)'}
        </Text>
      </Box>
      {options.map((opt, idx) => {
        const isSelected = idx === selectedIdx
        return (
          <Box key={opt.label}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text color={opt.color} bold={isSelected}>
              {opt.label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
