/**
 * ServerCard — Compact display card for a single MCP server.
 *
 * A self-contained row showing the server name with an optional (official)
 * badge, a dimmed description line, and a dimmed `> owner/repo` install ID.
 * Highlights when focused for use in scrollable lists.
 *
 * @example
 * <ServerCard
 *   name="Playwright"
 *   description="Browser automation via MCP"
 *   path="/servers/microsoft/playwright-mcp"
 *   isOfficial
 *   isFocused
 * />
 */

import React from 'react'
import { Box, Text } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServerCardProps = {
  /** Server display name. */
  name: string
  /** Short description text. */
  description: string
  /** Full path on mcpservers.org (e.g. "/servers/microsoft/playwright-mcp"). */
  path: string
  /** Whether the server is an official listing. */
  isOfficial?: boolean
  /** Whether this card is currently keyboard-focused. */
  isFocused?: boolean
  /** Optional 1-based index number shown before the name. */
  index?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerCard({
  name,
  description,
  path,
  isOfficial = false,
  isFocused = false,
  index,
}: ServerCardProps): React.ReactElement {
  const colors = getActiveColors()

  const id = path.replace(/^\/servers\//, '')
  const truncDesc = description.length > 90
    ? description.slice(0, 87) + '...'
    : description

  return (
    <Box flexDirection="column">
      {/* Name row */}
      <Box flexDirection="row">
        <Text color={isFocused ? colors.primary : undefined}>
          {isFocused ? '\u276F ' : '  '}
        </Text>
        {index !== undefined && (
          <Text dimColor>
            {String(index).padStart(2, ' ')}.{' '}
          </Text>
        )}
        <Text color={isFocused ? colors.primary : colors.text} bold={isFocused}>
          {name}
        </Text>
        {isOfficial && (
          <Text color={colors.success}>{' '}(official)</Text>
        )}
      </Box>

      {/* Description row */}
      {truncDesc && (
        <Box marginLeft={index !== undefined ? 7 : 3}>
          <Text dimColor>{truncDesc}</Text>
        </Box>
      )}

      {/* ID row */}
      <Box marginLeft={index !== undefined ? 7 : 3}>
        <Text color={isFocused ? colors.muted : undefined} dimColor={!isFocused}>
          {'> '}{id}
        </Text>
      </Box>
    </Box>
  )
}

export default ServerCard
