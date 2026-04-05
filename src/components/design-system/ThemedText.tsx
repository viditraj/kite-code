/**
 * ThemedText — A Text component that resolves theme token colors from context.
 *
 * Wraps Ink's Text with automatic theme colour resolution. Pass a ThemeToken
 * string (e.g. "primary", "error") for the `color` prop and the component
 * will look up the actual colour from the active theme.
 *
 * @example
 * <ThemedText color="primary">Hello</ThemedText>
 * <ThemedText color="error" bold>Something went wrong</ThemedText>
 */

import React from 'react'
import { Text } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeToken = string

export type ThemedTextProps = {
  readonly color?: ThemeToken
  readonly backgroundColor?: ThemeToken
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strikethrough?: boolean
  readonly inverse?: boolean
  readonly dimColor?: boolean
  readonly wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end'
  readonly children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

function resolveColor(
  color: ThemeToken | undefined,
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

export function ThemedText({
  color,
  backgroundColor,
  children,
  ...rest
}: ThemedTextProps): React.ReactElement {
  const [, colors] = useTheme()

  const resolvedColor = resolveColor(color, colors)
  const resolvedBg = resolveColor(backgroundColor, colors)

  return (
    <Text
      color={resolvedColor}
      backgroundColor={resolvedBg}
      {...rest}
    >
      {children}
    </Text>
  )
}

export default ThemedText
