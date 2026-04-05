import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useInterval } from '../../ink/hooks/useInterval.js'
import { getColor } from '../../themes/activeTheme.js'
import {
  generateCommandSuggestions,
  getBestCommandMatch,
  findSlashCommandPrefix,
  type CommandSuggestion,
} from '../../utils/suggestions/commandSuggestions.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptInputProps {
  onSubmit: (value: string) => void
  placeholder?: string
  prefix?: string
  isActive?: boolean
  history?: string[]
  multiLine?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete the word immediately before `pos` and return the new value + cursor. */
function deleteWordBack(
  text: string,
  pos: number,
): { text: string; pos: number } {
  if (pos === 0) return { text, pos }

  // Skip any trailing whitespace, then delete until the next whitespace.
  let i = pos - 1
  while (i > 0 && text[i - 1] === ' ') i--
  while (i > 0 && text[i - 1] !== ' ') i--

  return {
    text: text.slice(0, i) + text.slice(pos),
    pos: i,
  }
}

// ---------------------------------------------------------------------------
// Cursor-aware line renderer
// ---------------------------------------------------------------------------

function renderLineWithCursor(
  line: string,
  cursorPos: number,
  showCursor: boolean,
  cursorVisible: boolean,
): React.ReactElement {
  if (!showCursor) {
    return <Text>{line}</Text>
  }

  const before = line.slice(0, cursorPos)
  const atCursor = cursorPos < line.length ? line[cursorPos] : undefined
  const after = cursorPos < line.length ? line.slice(cursorPos + 1) : ''

  // When cursor is in the "off" phase of blink, show the character normally
  if (!cursorVisible) {
    return <Text>{before}{atCursor ?? ' '}{after}</Text>
  }

  return (
    <Text>
      {before}
      {atCursor !== undefined ? (
        <Text inverse>{atCursor}</Text>
      ) : (
        <Text inverse>{' '}</Text>
      )}
      {after}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// PromptInput
// ---------------------------------------------------------------------------

export function PromptInput({
  onSubmit,
  placeholder,
  prefix,
  isActive = true,
  history = [],
  multiLine = false,
}: PromptInputProps): React.ReactElement {
  const [value, setValue] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [cursorVisible, setCursorVisible] = useState(true)

  // ---- Autocomplete state ----
  const [acSelectedIndex, setAcSelectedIndex] = useState(0)
  const [acDismissed, setAcDismissed] = useState(false)

  const acPrefix = useMemo(() => findSlashCommandPrefix(value), [value])
  const acSuggestions = useMemo(() => {
    if (acPrefix === null || acDismissed) return []
    return generateCommandSuggestions(acPrefix, 10)
  }, [acPrefix, acDismissed])

  const acGhostText = useMemo(() => {
    if (acPrefix === null || acPrefix.length === 0) return null
    return getBestCommandMatch(acPrefix)
  }, [acPrefix])

  const acVisible = isActive && acSuggestions.length > 0 && acPrefix !== null && !acDismissed

  // Reset autocomplete state when value changes
  useEffect(() => {
    setAcSelectedIndex(0)
    setAcDismissed(false)
  }, [value])

  // Blink the cursor every 530ms (standard terminal blink rate)
  useInterval(() => {
    setCursorVisible(prev => !prev)
  }, isActive ? 530 : null)

  // Stash the in-progress input when the user starts navigating history.
  const savedInput = useRef('')

  const resetState = useCallback(() => {
    setValue('')
    setCursorPos(0)
    setHistoryIndex(-1)
    savedInput.current = ''
  }, [])

  // -------------------------------------------------------------------
  // Input handler
  // -------------------------------------------------------------------

  useInput(
    (input, key) => {
      // Reset cursor to visible on any keystroke
      setCursorVisible(true)

      // ---- Autocomplete navigation (when visible) ----
      if (acVisible) {
        if (key.downArrow) {
          setAcSelectedIndex(prev =>
            prev < acSuggestions.length - 1 ? prev + 1 : 0,
          )
          return
        }
        if (key.upArrow) {
          setAcSelectedIndex(prev =>
            prev > 0 ? prev - 1 : acSuggestions.length - 1,
          )
          return
        }
        if (key.tab) {
          // Apply the selected suggestion
          const selected = acSuggestions[acSelectedIndex]
          if (selected) {
            const cmd = `/${selected.name} `
            setValue(cmd)
            setCursorPos(cmd.length)
            setAcDismissed(true)
          }
          return
        }
        if (key.escape) {
          setAcDismissed(true)
          return
        }
      }

      // ---- Return / Enter ----
      if (key.return) {
        // If autocomplete is visible and user presses Enter, apply the selection
        if (acVisible) {
          const selected = acSuggestions[acSelectedIndex]
          if (selected) {
            const cmd = `/${selected.name}`
            // Submit the command directly (no trailing space)
            onSubmit(cmd)
            resetState()
            return
          }
        }

        if (multiLine && key.shift) {
          // Insert a newline at the cursor position.
          setValue((prev) => prev.slice(0, cursorPos) + '\n' + prev.slice(cursorPos))
          setCursorPos((prev) => prev + 1)
          return
        }

        const trimmed = value.trim()
        if (trimmed.length > 0) {
          onSubmit(trimmed)
        }
        resetState()
        return
      }

      // ---- Backspace ----
      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setValue((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos))
          setCursorPos((prev) => prev - 1)
        }
        return
      }

      // ---- Left / Right arrows ----
      if (key.leftArrow) {
        setCursorPos((prev) => Math.max(0, prev - 1))
        return
      }
      if (key.rightArrow) {
        setCursorPos((prev) => Math.min(value.length, prev + 1))
        return
      }

      // ---- Up arrow – history navigation ----
      if (key.upArrow) {
        if (history.length === 0) return
        if (historyIndex === -1) {
          savedInput.current = value
        }
        const nextIndex = Math.min(historyIndex + 1, history.length - 1)
        const entry = history[history.length - 1 - nextIndex]
        setHistoryIndex(nextIndex)
        setValue(entry)
        setCursorPos(entry.length)
        return
      }

      // ---- Down arrow – history navigation ----
      if (key.downArrow) {
        if (historyIndex <= -1) return
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)

        if (nextIndex === -1) {
          setValue(savedInput.current)
          setCursorPos(savedInput.current.length)
        } else {
          const entry = history[history.length - 1 - nextIndex]
          setValue(entry)
          setCursorPos(entry.length)
        }
        return
      }

      // ---- Ctrl+A / Home – move to start ----
      if (key.ctrl && input === 'a') {
        setCursorPos(0)
        return
      }

      // ---- Ctrl+E / End – move to end ----
      if (key.ctrl && input === 'e') {
        setCursorPos(value.length)
        return
      }

      // ---- Ctrl+U – clear line ----
      if (key.ctrl && input === 'u') {
        setValue('')
        setCursorPos(0)
        return
      }

      // ---- Ctrl+K – kill to end of line ----
      if (key.ctrl && input === 'k') {
        setValue((prev) => prev.slice(0, cursorPos))
        return
      }

      // ---- Ctrl+W – delete word before cursor ----
      if (key.ctrl && input === 'w') {
        const result = deleteWordBack(value, cursorPos)
        setValue(result.text)
        setCursorPos(result.pos)
        return
      }

      // ---- Regular character input ----
      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos))
        setCursorPos((prev) => prev + input.length)
      }
    },
    { isActive },
  )

  // -------------------------------------------------------------------
  // Autocomplete dropdown renderer
  // -------------------------------------------------------------------

  const autocompleteDropdown = acVisible ? (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text dimColor>{'─'.repeat(50)}</Text>
      </Box>
      {acSuggestions.map((suggestion, index) => {
        const isSelected = index === acSelectedIndex
        const tag = suggestion.tag
        return (
          <Box key={suggestion.name}>
            <Text color={isSelected ? 'cyan' : undefined}>{isSelected ? '> ' : '  '}</Text>
            <Box width={22}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                /{suggestion.name}
              </Text>
            </Box>
            {tag && (
              <Text color="yellow">[{tag}] </Text>
            )}
            <Text dimColor>{suggestion.description}</Text>
          </Box>
        )
      })}
      <Box>
        <Text dimColor>{'↑↓ navigate  Tab/Enter select  Esc dismiss'}</Text>
      </Box>
    </Box>
  ) : null

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  const displayPrefix = prefix ?? '> '

  // Empty value – show placeholder with blinking cursor.
  if (value.length === 0 && placeholder) {
    // Cursor occupies the first char of placeholder so text doesn't shift
    const firstChar = placeholder[0] ?? ' '
    const rest = placeholder.slice(1)
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={getColor('success')}>{displayPrefix}</Text>
          {isActive && cursorVisible
            ? <Text inverse dimColor>{firstChar}</Text>
            : <Text dimColor>{firstChar}</Text>
          }
          <Text dimColor>{rest}</Text>
        </Box>
      </Box>
    )
  }

  // Multi-line rendering: split the value on newlines and show the cursor
  // on the correct line.
  if (multiLine && value.includes('\n')) {
    const lines = value.split('\n')
    let charOffset = 0

    return (
      <Box flexDirection="column">
        {lines.map((line, idx) => {
          const lineStart = charOffset
          charOffset += line.length + 1 // +1 for the '\n'

          const cursorOnThisLine =
            cursorPos >= lineStart && cursorPos <= lineStart + line.length
          const localCursor = cursorPos - lineStart

          return (
            <Box key={idx}>
              <Text color={getColor('success')}>{idx === 0 ? displayPrefix : '  '}</Text>
              {renderLineWithCursor(
                line,
                localCursor,
                isActive && cursorOnThisLine,
                cursorVisible,
              )}
            </Box>
          )
        })}
        {autocompleteDropdown}
      </Box>
    )
  }

  // Single-line rendering with ghost text and autocomplete dropdown.
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={getColor('success')}>{displayPrefix}</Text>
        {renderLineWithCursor(value, cursorPos, isActive, cursorVisible)}
        {acGhostText && !acVisible && (
          <Text dimColor>{acGhostText}</Text>
        )}
      </Box>
      {autocompleteDropdown}
    </Box>
  )
}
