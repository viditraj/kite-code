/**
 * WebFetchPermissionRequest — Permission dialog for web fetch operations.
 *
 * Shows the URL being fetched with allow/deny/always-allow choices.
 * Extracts and displays the hostname prominently.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface WebFetchPermissionRequestProps {
  url: string
  onAllow: () => void
  onDeny: () => void
  onAllowAlways: () => void
  isActive?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const CHOICES = [
  { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
  { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
  { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
] as const

// ============================================================================
// Helpers
// ============================================================================

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ============================================================================
// WebFetchPermissionRequest Component
// ============================================================================

export const WebFetchPermissionRequest: React.FC<WebFetchPermissionRequestProps> = ({
  url,
  onAllow,
  onDeny,
  onAllowAlways,
  isActive = true,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0)

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

  const hostname = extractHostname(url)

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
        <Text bold>Fetch URL</Text>
      </Box>

      {/* URL display */}
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Host: </Text>
          <Text color="cyan" bold>{hostname}</Text>
        </Box>
        <Box>
          <Text dimColor>URL:  </Text>
          <Text>{url.length > 80 ? url.slice(0, 80) + '\u2026' : url}</Text>
        </Box>
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

export default WebFetchPermissionRequest
