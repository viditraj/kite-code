/**
 * Pane — Bordered panel with title.
 *
 * A region of the terminal bounded by a border with a title text rendered
 * at the top. Used for containing related content in a visually grouped
 * section.
 *
 * @example
 * <Pane title="Settings" borderColor="primary">
 *   <Text>Content here</Text>
 * </Pane>
 *
 * @example
 * <Pane title="Output" width={60}>
 *   <Text>Some output</Text>
 * </Pane>
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaneProps = {
  /** Title displayed at the top of the pane. */
  title: string
  /** Pane body content. */
  children: React.ReactNode
  /** Border colour — theme token or raw colour string. */
  borderColor?: string
  /** Fixed width in characters. */
  width?: number
}

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

function resolveColor(
  color: string | undefined,
  colors: ThemeTokens,
): string | undefined {
  if (!color) return undefined
  if (color in colors) {
    return colors[color]
  }
  return color
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Pane({
  title,
  children,
  borderColor,
  width,
}: PaneProps): React.ReactElement {
  const [, colors] = useTheme()
  const resolvedBorder = resolveColor(borderColor, colors) ?? colors.border

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={resolvedBorder}
      width={width}
      paddingX={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={resolvedBorder}>
          {title}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  )
}

export default Pane
