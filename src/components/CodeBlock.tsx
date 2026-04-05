/**
 * CodeBlock — Renders a fenced code block with optional language label
 * and line numbers.
 *
 * Displays code inside a bordered Box, with dimmed line numbers on the
 * left and a language tag in the top-right corner.
 */

import React from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeBlockProps {
  /** The source code to display. */
  code: string
  /** Optional language identifier shown in the top-right corner. */
  language?: string
  /** Whether to render line numbers. Defaults to true. */
  showLineNumbers?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeBlock({
  code,
  language,
  showLineNumbers = true,
}: CodeBlockProps): React.ReactElement {
  const lines = code.split('\n')
  // Remove a trailing empty line that results from a trailing newline.
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  const gutterWidth = showLineNumbers ? String(lines.length).length : 0

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {/* Language label */}
      {language && (
        <Box justifyContent="flex-end">
          <Text color="cyan" bold>
            {language}
          </Text>
        </Box>
      )}

      {/* Code lines */}
      {lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(gutterWidth, ' ')

        return (
          <Box key={idx}>
            {showLineNumbers && (
              <Text dimColor>
                {lineNum}  {'│'}{' '}
              </Text>
            )}
            <Text>{line}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
