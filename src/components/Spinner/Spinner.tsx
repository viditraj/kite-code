import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { useInterval } from '../../ink/hooks/useInterval.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpinnerMode = 'thinking' | 'working' | 'idle'

export interface SpinnerProps {
  mode?: SpinnerMode
  message?: string
  showElapsed?: boolean
  startTime?: number
}

export interface SpinnerWithVerbProps {
  verb?: string
  color?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_INTERVAL = 80 // ms

const MODE_MESSAGES: Record<SpinnerMode, string> = {
  thinking: 'Thinking',
  working: 'Working',
  idle: 'Idle',
}

const MODE_COLORS: Record<SpinnerMode, string> = {
  thinking: 'yellow',
  working: 'cyan',
  idle: 'gray',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(startTime: number): string {
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)

  if (elapsedSeconds < 60) {
    return `(${elapsedSeconds}s)`
  }

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return `(${minutes}m ${seconds}s)`
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export function Spinner({
  mode = 'thinking',
  message,
  showElapsed,
  startTime,
}: SpinnerProps): React.ReactElement {
  const [frameIndex, setFrameIndex] = useState(0)

  // Pause animation when idle (pass null delay)
  useInterval(
    () => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
    },
    mode === 'idle' ? null : FRAME_INTERVAL,
  )

  const frame = SPINNER_FRAMES[frameIndex]
  const modeColor = MODE_COLORS[mode]
  const displayMessage = message ?? MODE_MESSAGES[mode]

  const elapsed =
    showElapsed && startTime != null ? (
      <Text color="gray"> {formatElapsed(startTime)}</Text>
    ) : null

  return (
    <Box>
      <Text color={modeColor}>{frame} </Text>
      <Text>{displayMessage}</Text>
      {elapsed}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SpinnerWithVerb
// ---------------------------------------------------------------------------

export function SpinnerWithVerb({
  verb = '',
  color,
}: SpinnerWithVerbProps): React.ReactElement {
  const [frameIndex, setFrameIndex] = useState(0)

  useInterval(() => {
    setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
  }, FRAME_INTERVAL)

  const frame = SPINNER_FRAMES[frameIndex]

  return (
    <Box>
      <Text color={color}>
        {frame} {verb}
      </Text>
    </Box>
  )
}
