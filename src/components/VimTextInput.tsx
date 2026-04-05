/**
 * VimTextInput — Full vim-mode text input component.
 *
 * Uses the useVimMode hook from /root/kite-ts/src/ink/hooks/useVimMode.ts
 * to provide vim-style editing with mode indicator below the input.
 * Shows "-- INSERT --" / "-- NORMAL --" / "-- VISUAL --" status.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text } from 'ink'
import { useVimMode } from '../ink/hooks/useVimMode.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VimTextInputProps {
  /** Current text value. */
  value: string
  /** Called when the text value changes. */
  onChange: (value: string) => void
  /** Called when the user submits (Enter in insert mode). */
  onSubmit: (value: string) => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
  /** Placeholder text shown when value is empty. */
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VimTextInput({
  value,
  onChange,
  onSubmit,
  isActive = true,
  placeholder,
}: VimTextInputProps): React.ReactElement {
  const vim = useVimMode({
    initialValue: value,
    isActive,
    onSubmit,
  })

  // Sync external value → vim state
  useEffect(() => {
    if (vim.value !== value) {
      vim.setValue(value)
    }
  }, [value])

  // Sync vim state → external onChange
  useEffect(() => {
    if (vim.value !== value) {
      onChange(vim.value)
    }
  }, [vim.value])

  const text = vim.value
  const cursor = vim.cursorPos
  const mode = vim.mode

  // Render text with visible cursor
  const isEmpty = text.length === 0
  const before = text.slice(0, cursor)
  const atCursor = cursor < text.length ? text[cursor] : undefined
  const after = cursor < text.length ? text.slice(cursor + 1) : ''

  // Mode indicator colours
  const modeColor =
    mode === 'insert'
      ? 'green'
      : mode === 'visual'
        ? 'magenta'
        : 'blue'

  return (
    <Box flexDirection="column">
      {/* Input line */}
      <Box>
        <Text color="cyan">&gt; </Text>
        {isEmpty && placeholder ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <Box>
            <Text>{before}</Text>
            {isActive ? (
              <Text
                inverse={mode !== 'insert'}
                underline={mode === 'insert'}
                color={mode === 'insert' ? undefined : modeColor}
              >
                {atCursor ?? ' '}
              </Text>
            ) : (
              <Text>{atCursor ?? ''}</Text>
            )}
            <Text>{after}</Text>
          </Box>
        )}
      </Box>

      {/* Mode indicator */}
      {isActive && (
        <Box>
          <Text color={modeColor} bold>
            {vim.statusLine}
          </Text>
        </Box>
      )}
    </Box>
  )
}
