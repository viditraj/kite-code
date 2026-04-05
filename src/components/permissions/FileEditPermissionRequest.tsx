/**
 * FileEditPermissionRequest — Permission dialog for file edit operations.
 *
 * Shows an inline diff with red/green lines for removed/added content,
 * with allow/deny/always-allow choices.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface FileEditPermissionRequestProps {
  filePath: string
  oldString: string
  newString: string
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
// FileEditPermissionRequest Component
// ============================================================================

export const FileEditPermissionRequest: React.FC<FileEditPermissionRequestProps> = ({
  filePath,
  oldString,
  newString,
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
  const lastSlash = filePath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : ''
  const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath

  // Build inline diff
  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')

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
        <Text bold>Edit File</Text>
      </Box>

      {/* File path */}
      <Box marginLeft={2}>
        <Text dimColor>{dir}</Text>
        <Text color="cyan" bold>{filename}</Text>
      </Box>

      {/* Diff in a bordered box */}
      <Box
        marginLeft={2}
        marginTop={1}
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        {/* Removed lines */}
        {oldLines.map((line, i) => (
          <Box key={`old-${i}`}>
            <Text color="red">{'- '}{line}</Text>
          </Box>
        ))}

        {/* Visual separator between old and new */}
        {oldLines.length > 0 && newLines.length > 0 && (
          <Text dimColor>{'\u2500'.repeat(40)}</Text>
        )}

        {/* Added lines */}
        {newLines.map((line, i) => (
          <Box key={`new-${i}`}>
            <Text color="green">{'+ '}{line}</Text>
          </Box>
        ))}
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

export default FileEditPermissionRequest
