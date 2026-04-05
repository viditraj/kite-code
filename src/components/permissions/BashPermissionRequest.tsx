/**
 * BashPermissionRequest — Permission dialog for shell command execution.
 *
 * Shows the command in a code box with allow/deny/always-allow choices.
 * Highlights dangerous commands (rm, sudo, etc.) in red.
 * Uses y/n/a quick keys matching the PermissionRequest pattern.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface BashPermissionRequestProps {
  command: string
  description?: string
  onAllow: () => void
  onDeny: () => void
  onAllowAlways: () => void
  isActive?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const DANGEROUS_PATTERNS = [
  /\brm\s/,
  /\brm$/,
  /\bsudo\s/,
  /\bsudo$/,
  /\bchmod\s/,
  /\bchown\s/,
  /\bmkfs\b/,
  /\bdd\s/,
  /\b>\s*\/dev\//,
  /\bkill\s/,
  /\bkillall\s/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\brm\s+-rf?\s/,
  /\bformat\b/,
]

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command))
}

const CHOICES = [
  { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
  { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
  { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
] as const

// ============================================================================
// BashPermissionRequest Component
// ============================================================================

export const BashPermissionRequest: React.FC<BashPermissionRequestProps> = ({
  command,
  description,
  onAllow,
  onDeny,
  onAllowAlways,
  isActive = true,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const dangerous = isDangerous(command)

  useInput((inputStr, key) => {
    if (!isActive) return

    if (key.leftArrow) {
      setSelectedIdx((prev) => (prev - 1 + CHOICES.length) % CHOICES.length)
      return
    }
    if (key.rightArrow || key.tab) {
      setSelectedIdx((prev) => (prev + 1) % CHOICES.length)
      return
    }

    if (key.return) {
      const choice = CHOICES[selectedIdx]!
      if (choice.key === 'allow') onAllow()
      else if (choice.key === 'always') onAllowAlways()
      else onDeny()
      return
    }

    if (inputStr === 'y' || inputStr === 'Y') { onAllow(); return }
    if (inputStr === 'a' || inputStr === 'A') { onAllowAlways(); return }
    if (inputStr === 'n' || inputStr === 'N') { onDeny(); return }
    if (key.escape) { onDeny(); return }
  }, { isActive })

  // Render choices row
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
        <Text bold>Bash Command</Text>
        {description && (
          <>
            <Text dimColor>{' \u2014 '}</Text>
            <Text>{description}</Text>
          </>
        )}
      </Box>

      {/* Dangerous warning */}
      {dangerous && (
        <Box marginLeft={2}>
          <Text color="red" bold>{'\u26A0 Warning: '}</Text>
          <Text color="red">This command may be destructive</Text>
        </Box>
      )}

      {/* Command in a code box */}
      <Box
        marginLeft={2}
        marginTop={1}
        borderStyle="round"
        borderColor={dangerous ? 'red' : 'gray'}
        paddingX={1}
      >
        <Text color={dangerous ? 'red' : 'white'} bold>
          {'$ '}{command}
        </Text>
      </Box>

      {/* Choices */}
      <Box marginTop={1} gap={1}>
        {choiceRow}
      </Box>

      {/* Bottom separator */}
      <Text color="yellow">{'\u2500'.repeat(60)}</Text>
    </Box>
  )
}

export default BashPermissionRequest
