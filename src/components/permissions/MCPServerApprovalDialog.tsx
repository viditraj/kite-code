/**
 * MCPServerApprovalDialog — Approval dialog for MCP server connections.
 *
 * Shows server details (name, type) with approve/deny choices.
 * Uses y/n quick keys matching the PermissionRequest pattern.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface MCPServerApprovalDialogProps {
  serverName: string
  serverType: string
  onApprove: () => void
  onDeny: () => void
  isActive?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const CHOICES = [
  { key: 'approve', label: 'Approve', hint: 'y', color: 'green' },
  { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
] as const

const TYPE_ICONS: Record<string, string> = {
  stdio: '\u2699',  // ⚙
  sse: '\u21C4',     // ⇄
  http: '\u2601',    // ☁
}

// ============================================================================
// MCPServerApprovalDialog Component
// ============================================================================

export const MCPServerApprovalDialog: React.FC<MCPServerApprovalDialogProps> = ({
  serverName,
  serverType,
  onApprove,
  onDeny,
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
      if (choice.key === 'approve') onApprove()
      else onDeny()
      return
    }

    if (inputStr === 'y' || inputStr === 'Y') { onApprove(); return }
    if (inputStr === 'n' || inputStr === 'N') { onDeny(); return }
    if (key.escape) { onDeny(); return }
  }, { isActive })

  const typeIcon = TYPE_ICONS[serverType] ?? '\u2699'

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
        <Text bold>MCP Server Connection</Text>
      </Box>

      {/* Server details */}
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Server: </Text>
          <Text color="cyan" bold>{serverName}</Text>
        </Box>
        <Box>
          <Text dimColor>Type:   </Text>
          <Text>{typeIcon} {serverType}</Text>
        </Box>
      </Box>

      {/* Description */}
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>
          Allow this MCP server to connect and provide tools?
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

export default MCPServerApprovalDialog
