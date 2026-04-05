/**
 * CommandAutocomplete — dropdown suggestion list for slash commands.
 *
 * Adapted from Claude Code's PromptInputFooterSuggestions.tsx for Kite.
 * Renders a list of matching commands below the prompt input when the
 * user types '/'. Supports keyboard navigation (arrow keys, Tab, Enter).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import {
  generateCommandSuggestions,
  getBestCommandMatch,
  findSlashCommandPrefix,
  type CommandSuggestion,
} from '../utils/suggestions/commandSuggestions.js'

// ============================================================================
// Types
// ============================================================================

export interface CommandAutocompleteProps {
  /** Current input value */
  inputValue: string
  /** Whether the autocomplete is active */
  isActive: boolean
  /** Callback when a suggestion is selected */
  onSelect: (command: string) => void
  /** Callback when suggestions change (for ghost text) */
  onGhostTextChange?: (ghostText: string | null) => void
  /** Maximum visible suggestions */
  maxVisible?: number
}

export interface CommandAutocompleteResult {
  /** Current suggestions list */
  suggestions: CommandSuggestion[]
  /** Index of the currently selected suggestion */
  selectedIndex: number
  /** Whether the autocomplete dropdown is visible */
  isVisible: boolean
  /** Ghost text for inline completion */
  ghostText: string | null
}

// ============================================================================
// Component
// ============================================================================

export const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  inputValue,
  isActive,
  onSelect,
  onGhostTextChange,
  maxVisible = 10,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  // Detect slash command prefix
  const prefix = useMemo(() => findSlashCommandPrefix(inputValue), [inputValue])

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (prefix === null || dismissed) return []
    return generateCommandSuggestions(prefix, maxVisible + 5)
  }, [prefix, dismissed, maxVisible])

  // Ghost text for inline completion
  const ghostText = useMemo(() => {
    if (prefix === null || prefix.length === 0) return null
    return getBestCommandMatch(prefix)
  }, [prefix])

  // Notify parent of ghost text changes
  useEffect(() => {
    onGhostTextChange?.(ghostText)
  }, [ghostText, onGhostTextChange])

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions.length, prefix])

  // Reset dismissed when input changes
  useEffect(() => {
    setDismissed(false)
  }, [inputValue])

  const isVisible = isActive && suggestions.length > 0 && prefix !== null && !dismissed

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!isVisible) return

      if (key.downArrow) {
        setSelectedIndex(prev =>
          prev < Math.min(suggestions.length, maxVisible) - 1 ? prev + 1 : 0,
        )
        return
      }

      if (key.upArrow) {
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : Math.min(suggestions.length, maxVisible) - 1,
        )
        return
      }

      if (key.tab || key.return) {
        const selected = suggestions[selectedIndex]
        if (selected) {
          onSelect(`/${selected.name}`)
          setDismissed(true)
        }
        return
      }

      if (key.escape) {
        setDismissed(true)
        return
      }
    },
    { isActive: isVisible },
  )

  if (!isVisible) return null

  const visibleSuggestions = suggestions.slice(0, maxVisible)

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box marginBottom={0}>
        <Text dimColor>{'─'.repeat(40)}</Text>
      </Box>
      {visibleSuggestions.map((suggestion, index) => (
        <SuggestionRow
          key={suggestion.name}
          suggestion={suggestion}
          isSelected={index === selectedIndex}
        />
      ))}
      {suggestions.length > maxVisible && (
        <Box>
          <Text dimColor>  ... {suggestions.length - maxVisible} more</Text>
        </Box>
      )}
    </Box>
  )
}

// ============================================================================
// Suggestion Row
// ============================================================================

const SuggestionRow: React.FC<{
  suggestion: CommandSuggestion
  isSelected: boolean
}> = ({ suggestion, isSelected }) => {
  const indicator = isSelected ? '>' : ' '
  const nameColor = isSelected ? 'cyan' : 'white'

  return (
    <Box>
      <Text color={isSelected ? 'cyan' : undefined}>{indicator} </Text>
      <Box width={20}>
        <Text color={nameColor} bold={isSelected}>
          /{suggestion.name}
        </Text>
        {suggestion.argumentHint && (
          <Text dimColor> {suggestion.argumentHint}</Text>
        )}
      </Box>
      <Text dimColor> {suggestion.description}</Text>
    </Box>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook variant for non-Ink consumers (readline REPL).
 * Returns suggestion state without rendering.
 */
export function useCommandAutocomplete(
  inputValue: string,
  isActive: boolean,
): CommandAutocompleteResult {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const prefix = useMemo(() => findSlashCommandPrefix(inputValue), [inputValue])

  const suggestions = useMemo(() => {
    if (prefix === null || dismissed) return []
    return generateCommandSuggestions(prefix, 15)
  }, [prefix, dismissed])

  const ghostText = useMemo(() => {
    if (prefix === null || prefix.length === 0) return null
    return getBestCommandMatch(prefix)
  }, [prefix])

  const isVisible = isActive && suggestions.length > 0 && prefix !== null && !dismissed

  // Reset on input change
  useEffect(() => {
    setSelectedIndex(0)
    setDismissed(false)
  }, [inputValue])

  return {
    suggestions,
    selectedIndex,
    isVisible,
    ghostText,
  }
}
