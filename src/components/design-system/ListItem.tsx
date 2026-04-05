/**
 * ListItem — Selectable list item for menus, dropdowns, and selection UIs.
 *
 * Renders an optional icon, a label, and optional hint text. Highlights when
 * selected or active.
 *
 * @example
 * <ListItem label="Option 1" isSelected />
 * <ListItem icon=">" label="Files" hint="3 items" isActive />
 * <ListItem label="Disabled" color="gray" />
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListItemProps = {
  /** Optional icon rendered before the label. */
  icon?: string
  /** Primary text for the item. */
  label: string
  /** Secondary hint text rendered after the label, dimmed. */
  hint?: string
  /** Whether this item is currently keyboard-selected (shows pointer). */
  isSelected?: boolean
  /** Whether this item is the active/chosen item (highlighted). */
  isActive?: boolean
  /** Override text colour — theme token or raw colour. */
  color?: string
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

export function ListItem({
  icon,
  label,
  hint,
  isSelected = false,
  isActive = false,
  color,
}: ListItemProps): React.ReactElement {
  const [, colors] = useTheme()
  const resolvedColor = resolveColor(color, colors)

  // Determine indicator
  const indicator = isSelected ? '\u276F ' : '  ' // ❯ or spaces

  // Determine text colour based on state
  const textColor = resolvedColor
    ?? (isActive ? colors.success : isSelected ? colors.primary : undefined)
  const isBold = isSelected || isActive

  return (
    <Box flexDirection="row">
      <Text color={isSelected ? colors.primary : undefined}>
        {indicator}
      </Text>
      {icon && (
        <Text color={textColor}>
          {icon}{' '}
        </Text>
      )}
      <Text color={textColor} bold={isBold}>
        {label}
      </Text>
      {hint && (
        <Text dimColor>
          {' '}
          {hint}
        </Text>
      )}
    </Box>
  )
}

export default ListItem
