import React, { useMemo } from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface FileDiff {
  filePath: string
  hunks: DiffHunk[]
  isNew?: boolean
  isDeleted?: boolean
  isBinary?: boolean
  isRenamed?: boolean
  oldPath?: string
}

// ---------------------------------------------------------------------------
// Stats helper
// ---------------------------------------------------------------------------

export function computeDiffStats(diffs: FileDiff[]): {
  additions: number
  deletions: number
  filesChanged: number
} {
  let additions = 0
  let deletions = 0

  for (const diff of diffs) {
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') {
          additions++
        } else if (line.type === 'remove') {
          deletions++
        }
      }
    }
  }

  return { additions, deletions, filesChanged: diffs.length }
}

// ---------------------------------------------------------------------------
// parsePatch
// ---------------------------------------------------------------------------

/**
 * Parse unified diff / patch text into structured FileDiff objects.
 *
 * Handles:
 *   - `diff --git a/path b/path` headers
 *   - `--- a/path` / `+++ b/path` pairs (when no `diff --git` is present)
 *   - `@@ -o,ol +n,nl @@` hunk headers
 *   - `+`, `-`, and ` ` prefixed lines
 *   - `Binary files … differ`
 *   - `new file mode`, `deleted file mode`
 *   - `rename from` / `rename to`
 */
export function parsePatch(patchText: string): FileDiff[] {
  const diffs: FileDiff[] = []
  const lines = patchText.split('\n')

  let currentDiff: FileDiff | null = null
  let currentHunk: DiffHunk | null = null
  let oldLineNum = 0
  let newLineNum = 0

  function pushCurrentDiff(): void {
    if (currentHunk && currentDiff) {
      currentDiff.hunks.push(currentHunk)
      currentHunk = null
    }
    if (currentDiff) {
      diffs.push(currentDiff)
      currentDiff = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // -------------------------------------------------------------------
    // diff --git header  →  start a new file diff
    // -------------------------------------------------------------------
    const gitDiffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (gitDiffMatch) {
      pushCurrentDiff()
      currentDiff = {
        filePath: gitDiffMatch[2],
        hunks: [],
      }
      continue
    }

    // -------------------------------------------------------------------
    // Metadata lines that appear between `diff --git` and the hunks
    // -------------------------------------------------------------------
    if (currentDiff && !currentHunk) {
      if (/^new file mode/.test(line)) {
        currentDiff.isNew = true
        continue
      }
      if (/^deleted file mode/.test(line)) {
        currentDiff.isDeleted = true
        continue
      }
      if (/^rename from (.+)/.test(line)) {
        const m = line.match(/^rename from (.+)/)
        if (m) {
          currentDiff.isRenamed = true
          currentDiff.oldPath = m[1]
        }
        continue
      }
      if (/^rename to (.+)/.test(line)) {
        // filePath should already be set from diff --git
        currentDiff.isRenamed = true
        continue
      }
      if (/^Binary files/.test(line) || /Binary files .+ differ/.test(line)) {
        currentDiff.isBinary = true
        continue
      }
      // Skip index, similarity, old mode, new mode, --- , +++ lines
      if (
        /^index /.test(line) ||
        /^similarity index/.test(line) ||
        /^old mode/.test(line) ||
        /^new mode/.test(line) ||
        /^--- /.test(line) ||
        /^\+\+\+ /.test(line)
      ) {
        continue
      }
    }

    // -------------------------------------------------------------------
    // Fallback: --- / +++ pair without a preceding diff --git header
    // -------------------------------------------------------------------
    if (!currentDiff && /^--- /.test(line)) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
      if (/^\+\+\+ /.test(nextLine)) {
        pushCurrentDiff()
        const filePath = nextLine
          .replace(/^\+\+\+ /, '')
          .replace(/^[ab]\//, '')
        currentDiff = { filePath, hunks: [] }
        i++ // skip the +++ line
        continue
      }
    }

    // -------------------------------------------------------------------
    // Hunk header
    // -------------------------------------------------------------------
    const hunkMatch = line.match(
      /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
    )
    if (hunkMatch) {
      // If we don't have a diff yet, create a placeholder one
      if (!currentDiff) {
        currentDiff = { filePath: 'unknown', hunks: [] }
      }
      // Push previous hunk
      if (currentHunk) {
        currentDiff.hunks.push(currentHunk)
      }
      const oldStart = parseInt(hunkMatch[1], 10)
      const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1
      const newStart = parseInt(hunkMatch[3], 10)
      const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1
      currentHunk = { oldStart, oldLines, newStart, newLines, lines: [] }
      oldLineNum = oldStart
      newLineNum = newStart
      continue
    }

    // -------------------------------------------------------------------
    // Diff content lines (inside a hunk)
    // -------------------------------------------------------------------
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.slice(1),
          newLineNumber: newLineNum,
        })
        newLineNum++
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'remove',
          content: line.slice(1),
          oldLineNumber: oldLineNum,
        })
        oldLineNum++
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        })
        oldLineNum++
        newLineNum++
      } else if (line.startsWith('\\')) {
        // "\ No newline at end of file" — skip
        continue
      } else {
        // Non-diff line encountered while in hunk → hunk is over
        if (currentDiff) {
          currentDiff.hunks.push(currentHunk)
        }
        currentHunk = null
      }
    }
  }

  // Flush whatever is still in progress
  pushCurrentDiff()

  return diffs
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padLineNum(num: number | undefined, width: number): string {
  if (num === undefined) {
    return ' '.repeat(width)
  }
  return String(num).padStart(width, ' ')
}

function truncateText(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text
  }
  return text.slice(0, maxWidth - 1) + '…'
}

function fileStatusLabel(diff: FileDiff): string {
  if (diff.isNew) return '[new]'
  if (diff.isDeleted) return '[deleted]'
  if (diff.isRenamed) return '[renamed]'
  return '[modified]'
}

function fileStatusIcon(diff: FileDiff): string {
  if (diff.isNew) return 'A'
  if (diff.isDeleted) return 'D'
  if (diff.isRenamed) return 'R'
  return 'M'
}

function fileStatusColor(diff: FileDiff): string {
  if (diff.isNew) return 'green'
  if (diff.isDeleted) return 'red'
  if (diff.isRenamed) return 'yellow'
  return 'cyan'
}

function computeLineNumWidth(hunks: DiffHunk[]): number {
  let maxLine = 0
  for (const hunk of hunks) {
    const oldEnd = hunk.oldStart + hunk.oldLines
    const newEnd = hunk.newStart + hunk.newLines
    if (oldEnd > maxLine) maxLine = oldEnd
    if (newEnd > maxLine) maxLine = newEnd
  }
  return Math.max(String(maxLine).length, 1)
}

// ---------------------------------------------------------------------------
// DiffLineView component
// ---------------------------------------------------------------------------

export interface DiffLineProps {
  line: DiffLine
  showLineNumbers?: boolean
  lineNumWidth?: number
  maxWidth?: number
}

export const DiffLineView: React.FC<DiffLineProps> = ({
  line,
  showLineNumbers = false,
  lineNumWidth = 4,
  maxWidth,
}) => {
  const content = maxWidth ? truncateText(line.content, maxWidth) : line.content
  const w = lineNumWidth

  if (line.type === 'add') {
    return (
      <Box>
        {showLineNumbers && (
          <Text color="gray">
            {padLineNum(undefined, w)} {padLineNum(line.newLineNumber, w)}{' '}
          </Text>
        )}
        <Text color="green" backgroundColor="greenBright">
          +
        </Text>
        <Text color="green">{content}</Text>
      </Box>
    )
  }

  if (line.type === 'remove') {
    return (
      <Box>
        {showLineNumbers && (
          <Text color="gray">
            {padLineNum(line.oldLineNumber, w)} {padLineNum(undefined, w)}{' '}
          </Text>
        )}
        <Text color="red" backgroundColor="redBright">
          -
        </Text>
        <Text color="red">{content}</Text>
      </Box>
    )
  }

  // context
  return (
    <Box>
      {showLineNumbers && (
        <Text color="gray">
          {padLineNum(line.oldLineNumber, w)} {padLineNum(line.newLineNumber, w)}{' '}
        </Text>
      )}
      <Text dimColor> {content}</Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DiffHunkView component
// ---------------------------------------------------------------------------

export interface DiffHunkViewProps {
  hunk: DiffHunk
  showLineNumbers?: boolean
  lineNumWidth?: number
  maxWidth?: number
}

export const DiffHunkView: React.FC<DiffHunkViewProps> = ({
  hunk,
  showLineNumbers = false,
  lineNumWidth = 4,
  maxWidth,
}) => {
  const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`

  return (
    <Box flexDirection="column">
      <Text color="cyan">{header}</Text>
      {hunk.lines.map((line, idx) => (
        <DiffLineView
          key={idx}
          line={line}
          showLineNumbers={showLineNumbers}
          lineNumWidth={lineNumWidth}
          maxWidth={maxWidth}
        />
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DiffFileView component
// ---------------------------------------------------------------------------

export interface DiffFileViewProps {
  diff: FileDiff
  showLineNumbers?: boolean
  maxWidth?: number
  collapsed?: boolean
}

export const DiffFileView: React.FC<DiffFileViewProps> = ({
  diff,
  showLineNumbers = false,
  maxWidth,
  collapsed = false,
}) => {
  const stats = useMemo(() => computeDiffStats([diff]), [diff])
  const statusLabel = fileStatusLabel(diff)
  const statusColor = fileStatusColor(diff)
  const lineNumWidth = useMemo(
    () => computeLineNumWidth(diff.hunks),
    [diff.hunks],
  )

  const displayPath = diff.isRenamed && diff.oldPath
    ? `${diff.oldPath} → ${diff.filePath}`
    : diff.filePath

  return (
    <Box flexDirection="column">
      {/* File header */}
      <Box>
        <Text color={statusColor} bold>
          {statusLabel}{' '}
        </Text>
        <Text bold>{displayPath}</Text>
      </Box>

      {/* Binary notice */}
      {diff.isBinary && (
        <Text dimColor italic>
          Binary file (no diff available)
        </Text>
      )}

      {/* Collapsed → show nothing beyond the header */}
      {!collapsed && !diff.isBinary && (
        <Box flexDirection="column">
          {diff.hunks.map((hunk, idx) => (
            <DiffHunkView
              key={idx}
              hunk={hunk}
              showLineNumbers={showLineNumbers}
              lineNumWidth={lineNumWidth}
              maxWidth={maxWidth}
            />
          ))}
        </Box>
      )}

      {/* Stats line */}
      <Box>
        <Text color="green">+{stats.additions}</Text>
        <Text> </Text>
        <Text color="red">-{stats.deletions}</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DiffSummary component
// ---------------------------------------------------------------------------

export interface DiffSummaryProps {
  diffs: FileDiff[]
}

export const DiffSummary: React.FC<DiffSummaryProps> = ({ diffs }) => {
  const stats = useMemo(() => computeDiffStats(diffs), [diffs])

  return (
    <Box flexDirection="column">
      {diffs.map((diff, idx) => {
        const icon = fileStatusIcon(diff)
        const color = fileStatusColor(diff)
        const displayPath = diff.isRenamed && diff.oldPath
          ? `${diff.oldPath} → ${diff.filePath}`
          : diff.filePath

        return (
          <Box key={idx}>
            <Text color={color} bold>
              {icon}{' '}
            </Text>
            <Text>{displayPath}</Text>
          </Box>
        )
      })}
      <Box marginTop={1}>
        <Text>
          {stats.filesChanged} file{stats.filesChanged !== 1 ? 's' : ''} changed,{' '}
        </Text>
        <Text color="green">+{stats.additions}</Text>
        <Text> </Text>
        <Text color="red">-{stats.deletions}</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DiffView component (main)
// ---------------------------------------------------------------------------

export interface DiffViewProps {
  diffs: FileDiff[]
  showLineNumbers?: boolean
  maxWidth?: number
  showStats?: boolean
}

export const DiffView: React.FC<DiffViewProps> = ({
  diffs,
  showLineNumbers = false,
  maxWidth,
  showStats = true,
}) => {
  const stats = useMemo(() => computeDiffStats(diffs), [diffs])

  return (
    <Box flexDirection="column">
      {/* Summary header */}
      {showStats && (
        <Box marginBottom={1}>
          <Text bold>
            {stats.filesChanged} file{stats.filesChanged !== 1 ? 's' : ''} changed,{' '}
          </Text>
          <Text color="green" bold>
            +{stats.additions}
          </Text>
          <Text bold> </Text>
          <Text color="red" bold>
            -{stats.deletions}
          </Text>
        </Box>
      )}

      {/* File diffs with separators */}
      {diffs.map((diff, idx) => (
        <Box key={idx} flexDirection="column">
          {idx > 0 && (
            <Box marginTop={1} marginBottom={1}>
              <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>
          )}
          <DiffFileView
            diff={diff}
            showLineNumbers={showLineNumbers}
            maxWidth={maxWidth}
          />
        </Box>
      ))}
    </Box>
  )
}
