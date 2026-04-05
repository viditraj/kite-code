/**
 * Divider — Horizontal or vertical separator line.
 *
 * Renders a line of repeated characters to visually separate regions.
 * Supports horizontal (default) and vertical orientations, with several
 * line styles: single, double, and dashed.
 *
 * @example
 * // Full-width single line
 * <Divider />
 *
 * // Coloured double line
 * <Divider style="double" color="primary" />
 *
 * // Fixed-width dashed
 * <Divider width={40} style="dashed" />
 *
 * // Vertical separator
 * <Divider direction="vertical" />
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DividerProps = {
  /** Orientation: 'horizontal' (default) or 'vertical'. */
  direction?: 'horizontal' | 'vertical'
  /**
   * Width in characters for horizontal, or height in rows for vertical.
   * Defaults to 40 for horizontal.
   */
  width?: number
  /** Theme token or raw colour string. Uses dimColor if omitted. */
  color?: string
  /** Line style. @default 'single' */
  style?: 'single' | 'double' | 'dashed'
  /** Optional title centred in the divider (horizontal only). */
  title?: string
}

// ---------------------------------------------------------------------------
// Character maps
// ---------------------------------------------------------------------------

const HORIZONTAL_CHARS: Record<string, string> = {
  single: '\u2500',  // ─
  double: '\u2550',  // ═
  dashed: '\u254C',  // ╌
}

const VERTICAL_CHARS: Record<string, string> = {
  single: '\u2502',  // │
  double: '\u2551',  // ║
  dashed: '\u254E',  // ╎
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

export function Divider({
  direction = 'horizontal',
  width,
  color,
  style = 'single',
  title,
}: DividerProps): React.ReactElement {
  const [, colors] = useTheme()
  const resolvedColor = resolveColor(color, colors)
  const useDim = !color

  if (direction === 'vertical') {
    const char = VERTICAL_CHARS[style] ?? VERTICAL_CHARS.single!
    const h = width ?? 1
    return (
      <Box flexDirection="column">
        {Array.from({ length: h }, (_, i) => (
          <Text key={i} color={resolvedColor} dimColor={useDim}>
            {char}
          </Text>
        ))}
      </Box>
    )
  }

  // Horizontal
  const char = HORIZONTAL_CHARS[style] ?? HORIZONTAL_CHARS.single!
  const effectiveWidth = width ?? 40

  if (title) {
    const titleWidth = title.length + 2 // " Title "
    const sideWidth = Math.max(0, effectiveWidth - titleWidth)
    const leftWidth = Math.floor(sideWidth / 2)
    const rightWidth = sideWidth - leftWidth

    return (
      <Text color={resolvedColor} dimColor={useDim}>
        {char.repeat(leftWidth)}
        {' '}
        <Text dimColor>{title}</Text>
        {' '}
        {char.repeat(rightWidth)}
      </Text>
    )
  }

  return (
    <Text color={resolvedColor} dimColor={useDim}>
      {char.repeat(effectiveWidth)}
    </Text>
  )
}

export default Divider
