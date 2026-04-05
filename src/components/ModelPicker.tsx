/**
 * ModelPicker — Rich model selector with provider grouping and search.
 *
 * Displays models grouped by provider with color-coded labels.
 * Supports arrow-key navigation, Enter to select, Esc to cancel,
 * and type-ahead filtering.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelInfo {
  name: string
  provider: string
  description?: string
}

export interface ModelPickerProps {
  /** Available models to choose from. */
  models: ModelInfo[]
  /** Currently active model name. */
  currentModel: string
  /** Called when the user selects a model. */
  onSelect: (model: ModelInfo) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Provider colours
// ---------------------------------------------------------------------------

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'magenta',
  openai: 'green',
  ollama: 'yellow',
  groq: 'cyan',
  deepseek: 'blue',
  mistral: 'red',
  openrouter: 'white',
}

function colorForProvider(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? 'white'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelPicker({
  models,
  currentModel,
  onSelect,
  onCancel,
  isActive = true,
}: ModelPickerProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = models.findIndex((m) => m.name === currentModel)
    return idx >= 0 ? idx : 0
  })
  const [filter, setFilter] = useState('')

  // Filtered models based on search input
  const filtered = useMemo(() => {
    if (!filter) return models
    const lower = filter.toLowerCase()
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.provider.toLowerCase().includes(lower) ||
        (m.description ?? '').toLowerCase().includes(lower),
    )
  }, [models, filter])

  // Group filtered models by provider
  const grouped = useMemo(() => {
    const map = new Map<string, ModelInfo[]>()
    for (const m of filtered) {
      const existing = map.get(m.provider) ?? []
      existing.push(m)
      map.set(m.provider, existing)
    }
    return map
  }, [filtered])

  // Build a flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: ModelInfo[] = []
    for (const items of grouped.values()) {
      result.push(...items)
    }
    return result
  }, [grouped])

  // Clamp selection when filter changes
  const clampedIdx = Math.min(selectedIdx, Math.max(0, flatList.length - 1))

  useInput(
    (input, key) => {
      if (!isActive) return

      // Escape — cancel
      if (key.escape) {
        if (filter) {
          setFilter('')
          setSelectedIdx(0)
        } else {
          onCancel()
        }
        return
      }

      // Arrow navigation
      if (key.upArrow) {
        setSelectedIdx((prev) => (prev - 1 + flatList.length) % flatList.length)
        return
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => (prev + 1) % flatList.length)
        return
      }

      // Enter — select
      if (key.return) {
        const model = flatList[clampedIdx]
        if (model) onSelect(model)
        return
      }

      // Backspace — remove last filter char
      if (key.backspace || key.delete) {
        setFilter((prev) => prev.slice(0, -1))
        setSelectedIdx(0)
        return
      }

      // Ctrl+U — clear filter
      if (key.ctrl && input === 'u') {
        setFilter('')
        setSelectedIdx(0)
        return
      }

      // Regular character — append to filter
      if (input && !key.ctrl && !key.meta) {
        setFilter((prev) => prev + input)
        setSelectedIdx(0)
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Select Model
        </Text>
        <Text dimColor>
          {'  (↑↓ navigate, Enter select, type to filter, Esc cancel)'}
        </Text>
      </Box>

      {/* Search filter */}
      {filter && (
        <Box marginBottom={1}>
          <Text color="yellow">Filter: </Text>
          <Text>{filter}</Text>
          <Text inverse>{' '}</Text>
        </Box>
      )}

      {/* No results */}
      {flatList.length === 0 && (
        <Text dimColor>No models match &quot;{filter}&quot;</Text>
      )}

      {/* Grouped model list */}
      {Array.from(grouped.entries()).map(([provider, items]) => {
        const provColor = colorForProvider(provider)
        return (
          <Box key={provider} flexDirection="column" marginBottom={1}>
            {/* Provider header */}
            <Box>
              <Text color={provColor} bold>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </Text>
            </Box>

            {/* Models in this provider group */}
            {items.map((model) => {
              const flatIdx = flatList.indexOf(model)
              const isSelected = flatIdx === clampedIdx
              const isCurrent = model.name === currentModel
              return (
                <Box key={model.name}>
                  <Text color={isSelected ? 'cyan' : undefined}>
                    {isSelected ? '\u276F ' : '  '}
                  </Text>
                  <Text
                    color={isSelected ? provColor : undefined}
                    bold={isSelected}
                  >
                    {model.name}
                  </Text>
                  {isCurrent && (
                    <Text color="green">{' (current)'}</Text>
                  )}
                  {model.description && (
                    <Text dimColor>{`  ${model.description}`}</Text>
                  )}
                </Box>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}
