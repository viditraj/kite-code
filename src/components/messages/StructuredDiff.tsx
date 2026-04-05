/**
 * StructuredDiff — Full diff view with unified or split mode.
 *
 * Uses a simple LCS-based diff algorithm to compute changes between
 * old and new content. Unified mode shows standard -/+ format.
 * Green additions, red deletions, gray context lines.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface StructuredDiffProps {
  oldContent: string
  newContent: string
  filePath?: string
  mode?: 'unified' | 'split'
}

interface DiffHunk {
  type: 'context' | 'removed' | 'added'
  line: string
  oldLineNo?: number
  newLineNo?: number
}

// ============================================================================
// Diff Algorithm (simple LCS-based)
// ============================================================================

function computeUnifiedDiff(oldContent: string, newContent: string): DiffHunk[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffHunk[] = []

  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0) as number[]
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  // Backtrack
  const ops: Array<{ type: 'context' | 'removed' | 'added'; line: string }> = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'context', line: oldLines[i - 1]! })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.unshift({ type: 'added', line: newLines[j - 1]! })
      j--
    } else if (i > 0) {
      ops.unshift({ type: 'removed', line: oldLines[i - 1]! })
      i--
    }
  }

  // Assign line numbers
  let oldLineNo = 1
  let newLineNo = 1

  for (const op of ops) {
    switch (op.type) {
      case 'context':
        result.push({ type: 'context', line: op.line, oldLineNo, newLineNo })
        oldLineNo++
        newLineNo++
        break
      case 'removed':
        result.push({ type: 'removed', line: op.line, oldLineNo })
        oldLineNo++
        break
      case 'added':
        result.push({ type: 'added', line: op.line, newLineNo })
        newLineNo++
        break
    }
  }

  return result
}

// ============================================================================
// Helpers
// ============================================================================

function padNum(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width)
  const s = String(num)
  return ' '.repeat(Math.max(0, width - s.length)) + s
}

// ============================================================================
// StructuredDiff Component
// ============================================================================

export const StructuredDiff: React.FC<StructuredDiffProps> = ({
  oldContent,
  newContent,
  filePath,
  mode = 'unified',
}) => {
  const hunks = computeUnifiedDiff(oldContent, newContent)

  // Calculate gutter widths
  const maxOldLine = hunks.reduce((max, h) => Math.max(max, h.oldLineNo ?? 0), 0)
  const maxNewLine = hunks.reduce((max, h) => Math.max(max, h.newLineNo ?? 0), 0)
  const gutterWidth = Math.max(String(Math.max(maxOldLine, maxNewLine)).length, 3)

  if (mode === 'split') {
    return (
      <Box flexDirection="column">
        {/* File path header */}
        {filePath && (
          <Box>
            <Text color="cyan" bold>{filePath}</Text>
          </Box>
        )}

        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          {hunks.map((hunk, idx) => {
            const oldNum = padNum(hunk.oldLineNo, gutterWidth)
            const newNum = padNum(hunk.newLineNo, gutterWidth)

            if (hunk.type === 'context') {
              return (
                <Box key={idx}>
                  <Text color="gray">{oldNum} </Text>
                  <Text>{hunk.line}</Text>
                  <Text>{'  '}</Text>
                  <Text color="gray">{newNum} </Text>
                  <Text>{hunk.line}</Text>
                </Box>
              )
            }
            if (hunk.type === 'removed') {
              return (
                <Box key={idx}>
                  <Text color="gray">{oldNum} </Text>
                  <Text color="red">{'- '}{hunk.line}</Text>
                  <Text>{'  '}</Text>
                  <Text color="gray">{' '.repeat(gutterWidth)} </Text>
                  <Text>{' '}</Text>
                </Box>
              )
            }
            // added
            return (
              <Box key={idx}>
                <Text color="gray">{' '.repeat(gutterWidth)} </Text>
                <Text>{' '}</Text>
                <Text>{'  '}</Text>
                <Text color="gray">{newNum} </Text>
                <Text color="green">{'+ '}{hunk.line}</Text>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  }

  // Unified mode (default)
  return (
    <Box flexDirection="column">
      {/* File path header */}
      {filePath && (
        <Box>
          <Text color="cyan" bold>{filePath}</Text>
        </Box>
      )}

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {hunks.map((hunk, idx) => {
          const lineNo =
            hunk.type === 'removed'
              ? padNum(hunk.oldLineNo, gutterWidth)
              : hunk.type === 'added'
                ? padNum(hunk.newLineNo, gutterWidth)
                : padNum(hunk.oldLineNo, gutterWidth)

          const prefix =
            hunk.type === 'removed' ? '-' : hunk.type === 'added' ? '+' : ' '

          const color =
            hunk.type === 'removed'
              ? 'red'
              : hunk.type === 'added'
                ? 'green'
                : undefined

          return (
            <Box key={idx}>
              <Text color="gray">{lineNo} </Text>
              <Text color={color}>
                {prefix} {hunk.line}
              </Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default StructuredDiff
