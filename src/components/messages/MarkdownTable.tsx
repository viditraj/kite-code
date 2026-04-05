/**
 * MarkdownTable — Renders a markdown table with Box/Text primitives.
 *
 * Auto-calculates column widths, renders bold headers with horizontal
 * separators and vertical column dividers.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface MarkdownTableProps {
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'center' | 'right')[]
}

// ============================================================================
// Helpers
// ============================================================================

function computeColumnWidths(headers: string[], rows: string[][]): number[] {
  const widths = headers.map((h) => h.length)

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== undefined) {
        widths[i] = Math.max(widths[i] ?? 0, row[i]!.length)
      }
    }
  }

  return widths
}

function padCell(text: string, width: number, align: 'left' | 'center' | 'right'): string {
  if (text.length >= width) return text

  const diff = width - text.length

  switch (align) {
    case 'right':
      return ' '.repeat(diff) + text
    case 'center': {
      const left = Math.floor(diff / 2)
      const right = diff - left
      return ' '.repeat(left) + text + ' '.repeat(right)
    }
    case 'left':
    default:
      return text + ' '.repeat(diff)
  }
}

// ============================================================================
// MarkdownTable Component
// ============================================================================

export const MarkdownTable: React.FC<MarkdownTableProps> = ({
  headers,
  rows,
  alignments,
}) => {
  const colWidths = computeColumnWidths(headers, rows)
  const colCount = headers.length

  // Build separator line
  const separator = colWidths
    .map((w) => '\u2500'.repeat(w + 2))
    .join('\u253C')

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {headers.map((header, i) => {
          const align = alignments?.[i] ?? 'left'
          return (
            <Box key={i}>
              {i > 0 && <Text dimColor>{'\u2502'}</Text>}
              <Text bold> {padCell(header, colWidths[i]!, align)} </Text>
            </Box>
          )
        })}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{separator}</Text>
      </Box>

      {/* Data rows */}
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((cell, colIdx) => {
            const align = alignments?.[colIdx] ?? 'left'
            return (
              <Box key={colIdx}>
                {colIdx > 0 && <Text dimColor>{'\u2502'}</Text>}
                <Text> {padCell(cell ?? '', colWidths[colIdx]!, align)} </Text>
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export default MarkdownTable
