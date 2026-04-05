/**
 * FileWritePermissionRequest — Permission dialog for file write operations.
 *
 * Shows the file path and a preview of the first 10 lines of content
 * in a preview box, with allow/deny/always-allow choices.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface FileWritePermissionRequestProps {
  filePath: string
  contentPreview: string
  onAllow: () => void
  onDeny: () => void
  onAllowAlways: () => void
  isActive?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const MAX_PREVIEW_LINES = 10

const CHOICES = [
  { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
  { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
  { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
] as const

// ============================================================================
// FileWritePermissionRequest Component
// ============================================================================

export const FileWritePermissionRequest: React.FC<FileWritePermissionRequestProps> = ({
  filePath,
  contentPreview,
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

  // Prepare preview lines
  const lines = contentPreview.split('\n')
  const previewLines = lines.slice(0, MAX_PREVIEW_LINES)
  const hiddenCount = lines.length - previewLines.length

  // Extract filename from path
  const lastSlash = filePath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : ''
  const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath

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
        <Text bold>Write File</Text>
      </Box>

      {/* File path */}
      <Box marginLeft={2}>
        <Text dimColor>{dir}</Text>
        <Text color="cyan" bold>{filename}</Text>
      </Box>

      {/* Content preview box */}
      <Box
        marginLeft={2}
        marginTop={1}
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        {previewLines.map((line, i) => (
          <Box key={i}>
            <Text color="gray">{String(i + 1).padStart(3)} </Text>
            <Text>{line}</Text>
          </Box>
        ))}
        {hiddenCount > 0 && (
          <Text dimColor>  ... ({hiddenCount} more line{hiddenCount !== 1 ? 's' : ''})</Text>
        )}
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

export default FileWritePermissionRequest
