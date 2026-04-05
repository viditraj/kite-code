/**
 * PermissionRequest — permission prompt dialog for tool execution.
 *
 * Matches Claude Code's permission dialog pattern:
 * - Allow once / Always allow / Deny
 * - Quick keys: y/n/a
 * - Fixed-height layout to prevent border multiplication on re-render
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export type PermissionChoice = 'allow_once' | 'allow_always' | 'deny'

export interface PermissionRequestProps {
  toolName: string
  description: string
  message?: string
  input?: Record<string, unknown>
  onAllow: () => void
  onDeny: () => void
  onAllowAlways?: () => void
  isActive?: boolean
}

// ============================================================================
// Choice definitions — fixed array, never changes
// ============================================================================

const CHOICES = [
  { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
  { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
  { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
] as const

// ============================================================================
// PermissionRequest Component
// ============================================================================

export const PermissionRequest: React.FC<PermissionRequestProps> = ({
  toolName,
  description,
  message,
  input,
  onAllow,
  onDeny,
  onAllowAlways,
  isActive = true,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0)

  useInput((inputStr, key) => {
    if (!isActive) return

    if (key.leftArrow) {
      setSelectedIdx(prev => (prev - 1 + CHOICES.length) % CHOICES.length)
      return
    }
    if (key.rightArrow || key.tab) {
      setSelectedIdx(prev => (prev + 1) % CHOICES.length)
      return
    }

    if (key.return) {
      const choice = CHOICES[selectedIdx]!
      if (choice.key === 'allow') onAllow()
      else if (choice.key === 'always') (onAllowAlways ?? onAllow)()
      else onDeny()
      return
    }

    if (inputStr === 'y' || inputStr === 'Y') { onAllow(); return }
    if (inputStr === 'a' || inputStr === 'A') { (onAllowAlways ?? onAllow)(); return }
    if (inputStr === 'n' || inputStr === 'N') { onDeny(); return }
    if (key.escape) { onDeny(); return }
  }, { isActive })

  // Preformat input summary (fixed, doesn't change)
  const inputSummary = (input && Object.keys(input).length > 0)
    ? Object.entries(input)
        .map(([k, v]) => {
          const val = typeof v === 'string'
            ? (v.length > 80 ? v.slice(0, 80) + '\u2026' : v)
            : JSON.stringify(v)
          return `${k}: ${val}`
        })
        .join(', ')
    : null

  // Render choices as a fixed-width row — no layout shift on selection change
  const choiceRow = CHOICES.map((choice, idx) => {
    const sel = idx === selectedIdx
    return (
      <Text
        key={choice.key}
        color={sel ? choice.color : undefined}
        bold={sel}
        inverse={sel}
      >
        {` ${choice.label} (${choice.hint}) `}
      </Text>
    )
  })

  return (
    <Box flexDirection="column">
      {/* Top separator */}
      <Text color="yellow">{'\u2500'.repeat(60)}</Text>

      {/* Header */}
      <Box>
        <Text color="yellow" bold>{'\u26A1 '}</Text>
        <Text bold>{toolName}</Text>
        <Text dimColor>{' \u2014 '}</Text>
        <Text>{description}</Text>
      </Box>

      {/* Input summary */}
      {inputSummary && (
        <Box marginLeft={2}>
          <Text dimColor>{inputSummary}</Text>
        </Box>
      )}

      {/* Message */}
      {message && message !== description && (
        <Box marginLeft={2}>
          <Text dimColor italic>{message}</Text>
        </Box>
      )}

      {/* Choices — fixed row, only inverse changes */}
      <Box marginTop={1} gap={1}>
        {choiceRow}
      </Box>

      {/* Bottom separator */}
      <Text color="yellow">{'\u2500'.repeat(60)}</Text>
    </Box>
  )
}
