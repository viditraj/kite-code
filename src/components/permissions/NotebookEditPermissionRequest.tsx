/**
 * NotebookEditPermissionRequest — Permission dialog for Jupyter notebook edits.
 *
 * Shows the notebook path, cell number, and edit mode with
 * allow/deny/always-allow choices.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface NotebookEditPermissionRequestProps {
  notebookPath: string
  cellNumber: number
  editMode: string
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

const MODE_LABELS: Record<string, string> = {
  replace: 'Replace cell content',
  insert: 'Insert new cell',
  delete: 'Delete cell',
}

const MODE_COLORS: Record<string, string> = {
  replace: 'yellow',
  insert: 'green',
  delete: 'red',
}

// ============================================================================
// NotebookEditPermissionRequest Component
// ============================================================================

export const NotebookEditPermissionRequest: React.FC<NotebookEditPermissionRequestProps> = ({
  notebookPath,
  cellNumber,
  editMode,
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

  // Extract filename from path
  const lastSlash = notebookPath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? notebookPath.slice(0, lastSlash + 1) : ''
  const filename = lastSlash >= 0 ? notebookPath.slice(lastSlash + 1) : notebookPath

  const modeLabel = MODE_LABELS[editMode] ?? editMode
  const modeColor = MODE_COLORS[editMode] ?? 'white'

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
        <Text bold>Notebook Edit</Text>
      </Box>

      {/* Notebook path */}
      <Box marginLeft={2}>
        <Text dimColor>{dir}</Text>
        <Text color="cyan" bold>{filename}</Text>
      </Box>

      {/* Cell info */}
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Cell:      </Text>
          <Text bold>#{cellNumber}</Text>
        </Box>
        <Box>
          <Text dimColor>Operation: </Text>
          <Text color={modeColor} bold>{modeLabel}</Text>
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

export default NotebookEditPermissionRequest
