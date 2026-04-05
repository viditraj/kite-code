/**
 * InteractiveCommand — Renders interactive slash command UIs.
 *
 * Instead of dumping text for /help, /model, /provider, /theme, /mode,
 * these commands now show an arrow-key navigable selection list.
 * The user picks an option and the result is applied immediately.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface CommandItem {
  label: string
  value: string
  hint?: string
  color?: string
  /** Extra data passed through on selection */
  meta?: Record<string, string>
}

export interface InteractiveListProps {
  title: string
  items: CommandItem[]
  onSelect: (item: CommandItem) => void
  onCancel: () => void
  isActive?: boolean
}

// ============================================================================
// InteractiveList — arrow-key navigable selection
// ============================================================================

export const InteractiveList: React.FC<InteractiveListProps> = ({
  title,
  items,
  onSelect,
  onCancel,
  isActive = true,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0)

  useInput((input, key) => {
    if (!isActive) return

    if (key.upArrow) {
      setSelectedIdx(prev => (prev - 1 + items.length) % items.length)
      return
    }
    if (key.downArrow) {
      setSelectedIdx(prev => (prev + 1) % items.length)
      return
    }
    if (key.return) {
      const item = items[selectedIdx]
      if (item) onSelect(item)
      return
    }
    if (key.escape) {
      onCancel()
      return
    }

    // Number keys for quick select (1-9)
    const num = parseInt(input, 10)
    if (num >= 1 && num <= items.length) {
      const item = items[num - 1]
      if (item) onSelect(item)
      return
    }
  }, { isActive })

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>{title}</Text>
        <Text dimColor>  (arrow keys to navigate, Enter to select, Esc to cancel)</Text>
      </Box>

      {/* Items */}
      {items.map((item, idx) => {
        const isSelected = idx === selectedIdx
        return (
          <Box key={item.value}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text dimColor>{`${idx + 1}. `}</Text>
            <Text
              color={isSelected ? (item.color ?? 'cyan') : undefined}
              bold={isSelected}
            >
              {item.label}
            </Text>
            {item.hint && (
              <Text dimColor>{`  ${item.hint}`}</Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// ============================================================================
// Pre-built command item lists
// ============================================================================

export function getHelpItems(): CommandItem[] {
  return [
    { label: '/model', value: 'model', hint: 'Show or switch AI model' },
    { label: '/provider', value: 'provider', hint: 'Show or switch LLM provider' },
    { label: '/setup', value: 'setup', hint: 'Launch provider setup wizard' },
    { label: '/mode', value: 'mode', hint: 'Change permission mode' },
    { label: '/effort', value: 'effort', hint: 'Set model effort level' },
    { label: '/thinking', value: 'thinking', hint: 'Toggle thinking display' },
    { label: '/theme', value: 'theme', hint: 'Change color theme' },
    { label: '/output-style', value: 'output-style', hint: 'Set output verbosity' },
    { label: '/context', value: 'context', hint: 'Show token usage & context' },
    { label: '/stats', value: 'stats', hint: 'Session statistics' },
    { label: '/cost', value: 'cost', hint: 'Show session cost' },
    { label: '/compact', value: 'compact', hint: 'Compact conversation context' },
    { label: '/rewind', value: 'rewind', hint: 'Undo last exchange' },
    { label: '/summary', value: 'summary', hint: 'Summarize conversation' },
    { label: '/clear', value: 'clear', hint: 'Clear conversation' },
    { label: '/env', value: 'env', hint: 'Show environment info' },
    { label: '/sandbox', value: 'sandbox', hint: 'Sandbox status & toggle' },
    { label: '/diff', value: 'diff', hint: 'Show git changes' },
    { label: '/export', value: 'export', hint: 'Export conversation' },
    { label: '/login', value: 'login', hint: 'Configure API key' },
    { label: '/status', value: 'status', hint: 'System status' },
    { label: '/keybindings', value: 'keybindings', hint: 'Keyboard shortcuts' },
    { label: '/exit', value: 'exit', hint: 'Exit Kite' },
  ]
}

export function getModelItems(): CommandItem[] {
  return [
    { label: 'claude-sonnet-4-20250514', value: 'claude-sonnet-4-20250514', hint: 'Anthropic', color: 'magenta' },
    { label: 'claude-opus-4-20250514', value: 'claude-opus-4-20250514', hint: 'Anthropic', color: 'magenta' },
    { label: 'gpt-4o', value: 'gpt-4o', hint: 'OpenAI', color: 'green' },
    { label: 'gpt-4o-mini', value: 'gpt-4o-mini', hint: 'OpenAI', color: 'green' },
    { label: 'o3', value: 'o3', hint: 'OpenAI', color: 'green' },
    { label: 'llama3.1', value: 'llama3.1', hint: 'Ollama (local)', color: 'yellow' },
    { label: 'deepseek-chat', value: 'deepseek-chat', hint: 'DeepSeek', color: 'blue' },
    { label: 'mistral-large-latest', value: 'mistral-large-latest', hint: 'Mistral', color: 'red' },
    { label: 'codestral-latest', value: 'codestral-latest', hint: 'Mistral', color: 'red' },
  ]
}

export function getProviderItems(): CommandItem[] {
  return [
    { label: 'anthropic', value: 'anthropic', hint: 'Claude models (ANTHROPIC_API_KEY)', color: 'magenta',
      meta: { model: 'claude-sonnet-4-20250514', apiKeyEnv: 'ANTHROPIC_API_KEY', apiBaseUrl: '' } },
    { label: 'openai', value: 'openai', hint: 'GPT models (OPENAI_API_KEY)', color: 'green',
      meta: { model: 'gpt-4o', apiKeyEnv: 'OPENAI_API_KEY', apiBaseUrl: '' } },
    { label: 'ollama', value: 'ollama', hint: 'Local models (no key needed)', color: 'yellow',
      meta: { model: 'llama3.1', apiKeyEnv: '', apiBaseUrl: 'http://localhost:11434' } },
    { label: 'groq', value: 'groq', hint: 'Fast inference (GROQ_API_KEY)', color: 'cyan',
      meta: { model: 'llama-3.1-70b-versatile', apiKeyEnv: 'GROQ_API_KEY', apiBaseUrl: '' } },
    { label: 'deepseek', value: 'deepseek', hint: 'DeepSeek (DEEPSEEK_API_KEY)', color: 'blue',
      meta: { model: 'deepseek-chat', apiKeyEnv: 'DEEPSEEK_API_KEY', apiBaseUrl: '' } },
    { label: 'mistral', value: 'mistral', hint: 'Mistral (MISTRAL_API_KEY)', color: 'red',
      meta: { model: 'mistral-large-latest', apiKeyEnv: 'MISTRAL_API_KEY', apiBaseUrl: '' } },
    { label: 'openrouter', value: 'openrouter', hint: 'Multi-model gateway (OPENROUTER_API_KEY)',
      meta: { model: 'anthropic/claude-sonnet-4-20250514', apiKeyEnv: 'OPENROUTER_API_KEY', apiBaseUrl: '' } },
    { label: 'custom', value: '__setup__', hint: 'Custom / Self-Hosted endpoint (use /setup)', color: 'white' },
  ]
}

export function getModeItems(): CommandItem[] {
  return [
    { label: 'default', value: 'default', hint: 'Ask for each tool use', color: 'green' },
    { label: 'acceptEdits', value: 'acceptEdits', hint: 'Auto-accept file edits', color: 'yellow' },
    { label: 'plan', value: 'plan', hint: 'Plan mode (no execution)', color: 'cyan' },
    { label: 'bypassPermissions', value: 'bypassPermissions', hint: 'Allow all tools', color: 'red' },
    { label: 'dontAsk', value: 'dontAsk', hint: 'Never ask (deny if needed)', color: 'red' },
  ]
}

export function getThemeItems(): CommandItem[] {
  return [
    { label: 'dark', value: 'dark', hint: 'Default dark theme (cyan/magenta)' },
    { label: 'light', value: 'light', hint: 'Light theme (blue/magenta)' },
    { label: 'dark-colorblind', value: 'dark-colorblind', hint: 'Dark, deuteranopia-friendly' },
    { label: 'light-colorblind', value: 'light-colorblind', hint: 'Light, deuteranopia-friendly' },
    { label: 'dark-ansi', value: 'dark-ansi', hint: 'Dark, basic 8 ANSI colors only' },
    { label: 'light-ansi', value: 'light-ansi', hint: 'Light, basic 8 ANSI colors only' },
  ]
}
