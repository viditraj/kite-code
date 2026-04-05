/**
 * LoadingState — Skeleton / placeholder for loading content.
 *
 * Renders rows of ░ block characters to indicate content is loading.
 * Use this as a placeholder while data is being fetched.
 *
 * @example
 * // Default 3 lines, width 20
 * <LoadingState />
 *
 * // Custom size
 * <LoadingState lines={5} width={40} />
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoadingStateProps = {
  /** Number of placeholder lines. @default 3 */
  lines?: number
  /** Width of each line in characters. @default 20 */
  width?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK = '\u2591' // ░

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoadingState({
  lines = 3,
  width = 20,
}: LoadingStateProps): React.ReactElement {
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    // Vary line widths for a more natural skeleton look
    if (i === lines - 1) {
      return Math.max(4, Math.floor(width * 0.6))
    }
    if (i % 2 === 1) {
      return Math.max(4, Math.floor(width * 0.8))
    }
    return width
  })

  return (
    <Box flexDirection="column">
      {lineWidths.map((w, i) => (
        <Text key={i} dimColor>
          {BLOCK.repeat(w)}
        </Text>
      ))}
    </Box>
  )
}

export default LoadingState
