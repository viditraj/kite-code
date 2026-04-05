/**
 * Dialog — Modal dialog with title, content, and action buttons.
 *
 * Renders a bordered box with a title at the top, children content in the
 * middle, and optional action buttons at the bottom. Supports keyboard
 * navigation to cycle through and select actions.
 *
 * @example
 * <Dialog
 *   title="Confirm action"
 *   isOpen={true}
 *   actions={[
 *     { label: 'Yes', onSelect: handleYes },
 *     { label: 'No', onSelect: handleNo },
 *   ]}
 * >
 *   <Text>Are you sure you want to proceed?</Text>
 * </Dialog>
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DialogAction = {
  label: string
  onSelect: () => void
}

export type DialogProps = {
  /** Title displayed at the top of the dialog. */
  title: string
  /** Dialog body content. */
  children: React.ReactNode
  /** Action buttons displayed at the bottom. */
  actions?: DialogAction[]
  /** Whether the dialog is visible. */
  isOpen: boolean
  /** Border colour — theme token or raw colour string. */
  borderColor?: string
  /** Whether the dialog accepts keyboard input. Defaults to true when isOpen. */
  isActive?: boolean
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

export function Dialog({
  title,
  children,
  actions = [],
  isOpen,
  borderColor,
  isActive,
}: DialogProps): React.ReactElement | null {
  const [, colors] = useTheme()
  const [focusedIndex, setFocusedIndex] = useState(0)

  const active = isActive ?? isOpen

  useInput(
    (input, key) => {
      if (!active || actions.length === 0) return

      if (key.leftArrow || (key.shift && key.tab)) {
        setFocusedIndex((prev) =>
          prev <= 0 ? actions.length - 1 : prev - 1,
        )
        return
      }
      if (key.rightArrow || key.tab) {
        setFocusedIndex((prev) =>
          prev >= actions.length - 1 ? 0 : prev + 1,
        )
        return
      }
      if (key.return) {
        const action = actions[focusedIndex]
        if (action) {
          action.onSelect()
        }
        return
      }
      if (key.escape) {
        // If there's a last action (conventionally "Cancel"), trigger it
        const cancelAction = actions[actions.length - 1]
        if (cancelAction) {
          cancelAction.onSelect()
        }
        return
      }
    },
    { isActive: active },
  )

  if (!isOpen) return null

  const resolvedBorder = resolveColor(borderColor, colors) ?? colors.border

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={resolvedBorder}
      paddingX={1}
      paddingY={0}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={resolvedBorder}>
          {title}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" marginBottom={actions.length > 0 ? 1 : 0}>
        {children}
      </Box>

      {/* Actions */}
      {actions.length > 0 && (
        <Box flexDirection="row" gap={1}>
          {actions.map((action, i) => {
            const isFocused = i === focusedIndex
            return (
              <Box key={action.label}>
                <Text
                  inverse={isFocused}
                  bold={isFocused}
                  color={isFocused ? resolvedBorder : undefined}
                >
                  {' '}
                  {action.label}
                  {' '}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

export default Dialog
