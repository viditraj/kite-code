/**
 * StatusBar — Bottom status line with model, context usage, git, and controls.
 *
 * Shows: [MODE] model │ branch │ N msgs │ Xk/128k tokens (Y%) │ Ctrl+C
 */

import React from 'react'
import { Box, Text } from 'ink'
import { formatTokenCount, getContextWindowForModel } from '../utils/format.js'

export interface StatusBarProps {
  model: string
  provider: string
  isLoading: boolean
  messageCount: number
  tokenCount: number
  gitBranch?: string | null
  columns: number
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  provider,
  isLoading,
  messageCount,
  tokenCount,
  gitBranch,
  columns,
}) => {
  const mode = isLoading
    ? { label: ' WORKING ', bg: 'yellow', fg: 'black' }
    : { label: ' READY ', bg: 'green', fg: 'black' }

  const sep = '\u2502'
  const ctxWindow = getContextWindowForModel(model)
  const pct = tokenCount > 0 ? Math.round((tokenCount / ctxWindow) * 100) : 0
  const pctColor = pct > 80 ? 'red' : pct > 50 ? 'yellow' : undefined

  return (
    <Box>
      <Text backgroundColor={mode.bg as any} color={mode.fg as any} bold>{mode.label}</Text>
      <Text dimColor> {model}</Text>
      {gitBranch && (
        <>
          <Text dimColor> {sep} </Text>
          <Text color="magenta">{gitBranch}</Text>
        </>
      )}
      <Text dimColor> {sep} {messageCount} msg{messageCount !== 1 ? 's' : ''}</Text>
      {tokenCount > 0 && (
        <>
          <Text dimColor> {sep} </Text>
          <Text color={pctColor} dimColor={!pctColor}>{formatTokenCount(tokenCount)}/{formatTokenCount(ctxWindow)} ({pct}%)</Text>
        </>
      )}
      <Text dimColor> {sep} {isLoading ? 'Ctrl+C cancel' : 'Ctrl+C exit'}</Text>
    </Box>
  )
}
