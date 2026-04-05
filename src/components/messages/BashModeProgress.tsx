/**
 * BashModeProgress — Live-updating shell command progress display.
 *
 * Shows the command being executed, elapsed time, total bytes processed,
 * and a preview of the output in a bordered box.
 */

import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../Spinner/Spinner.js'
import { useInterval } from '../../ink/hooks/useInterval.js'

// ============================================================================
// Types
// ============================================================================

export interface BashModeProgressProps {
  command: string
  output: string
  elapsed: number
  totalBytes: number
}

// ============================================================================
// Constants
// ============================================================================

const MAX_OUTPUT_LINES = 15
const OUTPUT_UPDATE_INTERVAL = 500 // ms

// ============================================================================
// Helpers
// ============================================================================

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${Math.floor(secs)}s`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} B`
}

// ============================================================================
// BashModeProgress Component
// ============================================================================

export const BashModeProgress: React.FC<BashModeProgressProps> = ({
  command,
  output,
  elapsed,
  totalBytes,
}) => {
  // Force periodic re-renders to update the display
  const [, setTick] = useState(0)
  useInterval(() => {
    setTick((prev) => prev + 1)
  }, OUTPUT_UPDATE_INTERVAL)

  // Trim output to last N lines
  const outputLines = output.split('\n')
  const visibleLines = outputLines.slice(-MAX_OUTPUT_LINES)
  const hiddenLines = outputLines.length - visibleLines.length

  return (
    <Box flexDirection="column">
      {/* Command header with spinner */}
      <Box>
        <Spinner mode="working" />
        <Text> </Text>
        <Text color="cyan" bold>{'$ '}{command}</Text>
      </Box>

      {/* Status line */}
      <Box marginLeft={2}>
        <Text dimColor>
          {formatElapsed(elapsed)} elapsed
          {' \u2022 '}
          {formatBytes(totalBytes)} output
        </Text>
      </Box>

      {/* Output preview */}
      {visibleLines.length > 0 && visibleLines.some((l) => l.trim()) && (
        <Box
          marginLeft={2}
          marginTop={1}
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          {hiddenLines > 0 && (
            <Text dimColor>... ({hiddenLines} earlier line{hiddenLines !== 1 ? 's' : ''} hidden)</Text>
          )}
          {visibleLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default BashModeProgress
