/**
 * FilePathLink — Styled file path display.
 *
 * Shows path in cyan with dimmed directory parts and bold filename.
 * Optionally appends :lineNumber.
 */

import React from 'react'
import { Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface FilePathLinkProps {
  path: string
  lineNumber?: number
}

// ============================================================================
// FilePathLink Component
// ============================================================================

export const FilePathLink: React.FC<FilePathLinkProps> = ({ path, lineNumber }) => {
  const lastSlash = path.lastIndexOf('/')
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : ''
  const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path

  return (
    <Text>
      {dir && <Text color="cyan" dimColor>{dir}</Text>}
      <Text color="cyan" bold>{filename}</Text>
      {lineNumber !== undefined && (
        <Text color="cyan" dimColor>:{lineNumber}</Text>
      )}
    </Text>
  )
}

export default FilePathLink
