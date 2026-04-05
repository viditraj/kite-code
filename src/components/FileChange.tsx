/**
 * FileChange — Git-style file change indicator.
 *
 * Shows a file path with a colour-coded status badge and optional
 * addition / deletion counts, similar to `git diff --stat`.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export interface FileChangeProps {
  /** File path to display. */
  path: string
  /** Kind of change. */
  status: FileChangeStatus
  /** Number of added lines. */
  additions?: number
  /** Number of deleted lines. */
  deletions?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<FileChangeStatus, { symbol: string; color: string; label: string }> = {
  added:    { symbol: '+', color: 'green',  label: 'new file' },
  modified: { symbol: '~', color: 'yellow', label: 'modified' },
  deleted:  { symbol: '-', color: 'red',    label: 'deleted'  },
  renamed:  { symbol: '>', color: 'cyan',   label: 'renamed'  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileChange({
  path,
  status,
  additions,
  deletions,
}: FileChangeProps): React.ReactElement {
  const cfg = STATUS_CONFIG[status]

  const hasStats = additions !== undefined || deletions !== undefined

  return (
    <Box>
      {/* Status badge */}
      <Text color={cfg.color} bold>
        {' '}{cfg.symbol}{' '}
      </Text>

      {/* File path */}
      <Text>{path}</Text>

      {/* Stats */}
      {hasStats && (
        <Text dimColor>{'  '}</Text>
      )}
      {additions !== undefined && additions > 0 && (
        <Text color="green">{` +${additions}`}</Text>
      )}
      {deletions !== undefined && deletions > 0 && (
        <Text color="red">{` -${deletions}`}</Text>
      )}
    </Box>
  )
}
