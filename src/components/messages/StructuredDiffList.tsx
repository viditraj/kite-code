/**
 * StructuredDiffList — Summary list of changed files with +/- counts.
 *
 * Shows each file's status (added/modified/deleted) with color coding
 * and addition/deletion counts.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

export interface StructuredDiffListProps {
  files: FileChange[]
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  added:    { icon: '+', color: 'green',  label: 'added' },
  modified: { icon: '~', color: 'yellow', label: 'modified' },
  deleted:  { icon: '-', color: 'red',    label: 'deleted' },
  renamed:  { icon: '>', color: 'cyan',   label: 'renamed' },
}

// ============================================================================
// Helpers
// ============================================================================

function buildChangeBars(additions: number, deletions: number, maxWidth: number): React.ReactElement {
  const total = additions + deletions
  if (total === 0) {
    return <Text dimColor>{'\u2500'}</Text>
  }

  const barWidth = Math.min(total, maxWidth)
  const addBars = total > 0 ? Math.max(1, Math.round((additions / total) * barWidth)) : 0
  const delBars = barWidth - addBars

  return (
    <Text>
      <Text color="green">{'\u2588'.repeat(addBars)}</Text>
      <Text color="red">{'\u2588'.repeat(delBars)}</Text>
    </Text>
  )
}

// ============================================================================
// StructuredDiffList Component
// ============================================================================

export const StructuredDiffList: React.FC<StructuredDiffListProps> = ({
  files,
}) => {
  // Calculate totals
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

  // Calculate max path length for alignment
  const maxPathLen = Math.max(...files.map((f) => f.path.length), 0)
  const barWidth = 20

  return (
    <Box flexDirection="column">
      {/* File list */}
      {files.map((file, idx) => {
        const config = STATUS_CONFIG[file.status] ?? STATUS_CONFIG['modified']!
        const paddedPath = file.path + ' '.repeat(Math.max(0, maxPathLen - file.path.length))

        return (
          <Box key={idx}>
            <Text color={config.color} bold>{config.icon} </Text>
            <Text>{paddedPath} </Text>
            {file.additions > 0 && (
              <Text color="green">{'+' + file.additions} </Text>
            )}
            {file.deletions > 0 && (
              <Text color="red">{'-' + file.deletions} </Text>
            )}
            {buildChangeBars(file.additions, file.deletions, barWidth)}
          </Box>
        )
      })}

      {/* Summary line */}
      {files.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            {files.length} file{files.length !== 1 ? 's' : ''} changed
          </Text>
          {totalAdditions > 0 && (
            <Text color="green">{', +'}{totalAdditions} insertion{totalAdditions !== 1 ? 's' : ''}</Text>
          )}
          {totalDeletions > 0 && (
            <Text color="red">{', -'}{totalDeletions} deletion{totalDeletions !== 1 ? 's' : ''}</Text>
          )}
        </Box>
      )}
    </Box>
  )
}

export default StructuredDiffList
