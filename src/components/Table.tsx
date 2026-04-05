/**
 * Table — Simple text-mode table rendered with ink Box / Text.
 *
 * Columns are auto-sized to fit the widest cell in each column.
 * Headers are rendered in bold, with an optional border style
 * around the table.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableProps {
  /** Column header labels. */
  headers: string[]
  /** Row data — each inner array must have the same length as `headers`. */
  rows: string[][]
  /** ink borderStyle applied to the outer Box. Defaults to 'single'. */
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the max width for each column across headers and all rows. */
function computeColumnWidths(headers: string[], rows: string[][]): number[] {
  const widths = headers.map((h) => h.length)

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== undefined) {
        widths[i] = Math.max(widths[i] ?? 0, row[i].length)
      }
    }
  }

  return widths
}

function padRight(text: string, width: number): string {
  if (text.length >= width) return text
  return text + ' '.repeat(width - text.length)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Table({
  headers,
  rows,
  borderStyle = 'single',
}: TableProps): React.ReactElement {
  const colWidths = computeColumnWidths(headers, rows)
  const colCount = headers.length

  // Separator rendered between header and body.
  const separator = colWidths.map((w) => '\u2500'.repeat(w + 2)).join('\u253C')

  return (
    <Box flexDirection="column" borderStyle={borderStyle} borderColor="gray" paddingX={1}>
      {/* Header row */}
      <Box>
        {headers.map((header, i) => (
          <Box key={i} width={colWidths[i] + 2}>
            <Text bold>{padRight(header, colWidths[i])}</Text>
            {i < colCount - 1 && <Text dimColor>{' \u2502'}</Text>}
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{separator}</Text>
      </Box>

      {/* Data rows */}
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((cell, colIdx) => (
            <Box key={colIdx} width={colWidths[colIdx] + 2}>
              <Text>{padRight(cell ?? '', colWidths[colIdx])}</Text>
              {colIdx < colCount - 1 && <Text dimColor>{' \u2502'}</Text>}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}
