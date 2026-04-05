/**
 * KeyboardShortcutHint — Renders a keyboard shortcut with styled key badges.
 *
 * Shows each key in an inverse-coloured badge followed by an optional label.
 * Commonly used in status bars and help text.
 *
 * @example
 * // Single key with label
 * <KeyboardShortcutHint keys={['Enter']} label="confirm" />
 * // Renders: [Enter] confirm
 *
 * // Combo
 * <KeyboardShortcutHint keys={['Ctrl', 'C']} label="cancel" />
 * // Renders: [Ctrl] [C] cancel
 *
 * // Keys only
 * <KeyboardShortcutHint keys={['Esc']} />
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeyboardShortcutHintProps = {
  /** Keys to display as badges, e.g. ['Ctrl', 'C']. */
  keys: string[]
  /** Optional label shown after the key badges. */
  label?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutHint({
  keys,
  label,
}: KeyboardShortcutHintProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={0}>
      {keys.map((key, i) => (
        <Text key={`${key}-${i}`}>
          <Text inverse bold>
            {' '}
            {key}
            {' '}
          </Text>
          {i < keys.length - 1 ? ' ' : ''}
        </Text>
      ))}
      {label && (
        <Text dimColor>
          {' '}
          {label}
        </Text>
      )}
    </Box>
  )
}

export default KeyboardShortcutHint
