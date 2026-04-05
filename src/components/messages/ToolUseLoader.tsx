/**
 * ToolUseLoader — Tool execution indicator with spinner.
 *
 * Shows an animated spinner alongside the tool name and optional description
 * to indicate a tool is currently executing.
 */

import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../Spinner/Spinner.js'

// ============================================================================
// Types
// ============================================================================

export interface ToolUseLoaderProps {
  toolName: string
  description?: string
}

// ============================================================================
// ToolUseLoader Component
// ============================================================================

export const ToolUseLoader: React.FC<ToolUseLoaderProps> = ({
  toolName,
  description,
}) => {
  return (
    <Box>
      <Spinner mode="working" />
      <Text> </Text>
      <Text color="cyan" bold>{toolName}</Text>
      {description && (
        <Text dimColor>{' \u2014 '}{description}</Text>
      )}
    </Box>
  )
}

export default ToolUseLoader
