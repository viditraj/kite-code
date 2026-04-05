/**
 * ExportDialog — Export conversation to file.
 *
 * Two-step dialog:
 *   1. Enter a filename (text input)
 *   2. Select a format (md / json / txt)
 * Enter to export, Esc to cancel.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'md' | 'json' | 'txt'

export interface ExportDialogProps {
  /** Default filename (without extension). */
  defaultFilename: string
  /** Called when the user exports. */
  onExport: (filename: string, format: ExportFormat) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Format metadata
// ---------------------------------------------------------------------------

interface FormatOption {
  format: ExportFormat
  label: string
  description: string
}

const FORMATS: FormatOption[] = [
  { format: 'md', label: 'Markdown', description: '.md — Rich formatting with headers and code blocks' },
  { format: 'json', label: 'JSON', description: '.json — Structured data, machine-readable' },
  { format: 'txt', label: 'Plain Text', description: '.txt — Simple plain text' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportDialog({
  defaultFilename,
  onExport,
  onCancel,
  isActive = true,
}: ExportDialogProps): React.ReactElement {
  const [filename, setFilename] = useState(defaultFilename)
  const [cursorPos, setCursorPos] = useState(defaultFilename.length)
  const [step, setStep] = useState<'filename' | 'format'>('filename')
  const [formatIdx, setFormatIdx] = useState(0)

  useInput(
    (input, key) => {
      if (!isActive) return

      // Escape — cancel or go back
      if (key.escape) {
        if (step === 'format') {
          setStep('filename')
          return
        }
        onCancel()
        return
      }

      // ---- Step 1: Filename input ----
      if (step === 'filename') {
        if (key.return) {
          if (filename.trim().length > 0) {
            setStep('format')
          }
          return
        }

        if (key.backspace || key.delete) {
          if (cursorPos > 0) {
            setFilename((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos))
            setCursorPos((prev) => prev - 1)
          }
          return
        }

        if (key.leftArrow) {
          setCursorPos((prev) => Math.max(0, prev - 1))
          return
        }
        if (key.rightArrow) {
          setCursorPos((prev) => Math.min(filename.length, prev + 1))
          return
        }

        // Ctrl+U — clear
        if (key.ctrl && input === 'u') {
          setFilename('')
          setCursorPos(0)
          return
        }

        // Regular character input
        if (input && !key.ctrl && !key.meta) {
          setFilename((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos))
          setCursorPos((prev) => prev + input.length)
        }
        return
      }

      // ---- Step 2: Format selection ----
      if (step === 'format') {
        if (key.upArrow) {
          setFormatIdx((prev) => (prev - 1 + FORMATS.length) % FORMATS.length)
          return
        }
        if (key.downArrow) {
          setFormatIdx((prev) => (prev + 1) % FORMATS.length)
          return
        }
        if (key.return) {
          const fmt = FORMATS[formatIdx]
          if (fmt) {
            const fullName = filename.includes('.')
              ? filename
              : `${filename}.${fmt.format}`
            onExport(fullName, fmt.format)
          }
          return
        }

        // Number keys for quick select
        const num = parseInt(input, 10)
        if (num >= 1 && num <= FORMATS.length) {
          const fmt = FORMATS[num - 1]
          if (fmt) {
            const fullName = filename.includes('.')
              ? filename
              : `${filename}.${fmt.format}`
            onExport(fullName, fmt.format)
          }
          return
        }
      }
    },
    { isActive },
  )

  // Render the filename with cursor
  const before = filename.slice(0, cursorPos)
  const atCursor = cursorPos < filename.length ? filename[cursorPos] : undefined
  const after = cursorPos < filename.length ? filename.slice(cursorPos + 1) : ''

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Export Conversation
        </Text>
        <Text dimColor>{'  (Esc to cancel)'}</Text>
      </Box>

      {/* Step 1: Filename */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>
          {step === 'filename' ? '\u276F ' : '\u2713 '}
          Filename:
        </Text>
        <Box marginLeft={2}>
          {step === 'filename' ? (
            <Box>
              <Text color="cyan">&gt; </Text>
              <Text>{before}</Text>
              <Text inverse>{atCursor ?? ' '}</Text>
              <Text>{after}</Text>
            </Box>
          ) : (
            <Text dimColor>{filename}</Text>
          )}
        </Box>
      </Box>

      {/* Step 2: Format */}
      {step === 'format' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>{'\u276F Format:'}</Text>
            <Text dimColor>{'  (\u2191\u2193 navigate, Enter select)'}</Text>
          </Box>
          {FORMATS.map((fmt, idx) => {
            const isSelected = idx === formatIdx
            return (
              <Box key={fmt.format}>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? '  \u276F ' : '    '}
                </Text>
                <Text dimColor>{`${idx + 1}. `}</Text>
                <Text
                  color={isSelected ? 'cyan' : undefined}
                  bold={isSelected}
                >
                  {fmt.label}
                </Text>
                <Text dimColor>{`  ${fmt.description}`}</Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Hint */}
      {step === 'filename' && (
        <Text dimColor>{'Press Enter to choose format'}</Text>
      )}
    </Box>
  )
}
