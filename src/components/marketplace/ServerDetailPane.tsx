/**
 * ServerDetailPane — Rich detail view for a single MCP server.
 *
 * Shows the server name as a header, description text, metadata rows
 * (GitHub, Package, URL) with aligned labels, the JSON install config
 * in a code-styled section, and action hints at the bottom.
 *
 * @example
 * <ServerDetailPane
 *   detail={serverDetail}
 *   onInstall={() => install(detail)}
 *   onBack={() => setView('list')}
 *   isActive
 * />
 */

import React from 'react'
import { Box, Text, useInput } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'
import type { MarketplaceServerDetail } from '../../services/marketplace/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServerDetailPaneProps = {
  /** Full server detail object. */
  detail: MarketplaceServerDetail
  /** Called when user presses Enter to install. */
  onInstall: () => void
  /** Called when user presses Esc to go back. */
  onBack: () => void
  /** Whether this pane accepts keyboard input. @default true */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerDetailPane({
  detail,
  onInstall,
  onBack,
  isActive = true,
}: ServerDetailPaneProps): React.ReactElement {
  const colors = getActiveColors()

  useInput(
    (_input, key) => {
      if (!isActive) return

      if (key.return) {
        onInstall()
        return
      }
      if (key.escape) {
        onBack()
        return
      }
    },
    { isActive },
  )

  const id = detail.path.replace(/^\/servers\//, '')

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          {detail.name}
        </Text>
        {detail.isOfficial && (
          <Text color={colors.success}>{' '}(official)</Text>
        )}
      </Box>

      {/* Description */}
      {detail.description && (
        <Box marginBottom={1}>
          <Text>{detail.description}</Text>
        </Box>
      )}

      {/* Metadata rows */}
      <Box flexDirection="column" marginBottom={1}>
        {detail.githubUrl && (
          <Box>
            <Box width={10}><Text dimColor>GitHub</Text></Box>
            <Text color={colors.primary}>{detail.githubUrl}</Text>
          </Box>
        )}
        {detail.npmPackage && (
          <Box>
            <Box width={10}><Text dimColor>Package</Text></Box>
            <Text>{detail.npmPackage}</Text>
          </Box>
        )}
        <Box>
          <Box width={10}><Text dimColor>URL</Text></Box>
          <Text dimColor>https://mcpservers.org{detail.path}</Text>
        </Box>
        <Box>
          <Box width={10}><Text dimColor>ID</Text></Box>
          <Text>{id}</Text>
        </Box>
      </Box>

      {/* Config block */}
      {detail.standardConfig ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>{'─'.repeat(50)}</Text>
          <Box marginTop={0} marginBottom={0}>
            <Text dimColor bold>Config:</Text>
          </Box>
          {JSON.stringify(
            { mcpServers: { [detail.standardConfig.serverName]: detail.standardConfig.config } },
            null, 2,
          ).split('\n').map((line, i) => (
            <Text key={i} color={colors.muted}>{`  ${line}`}</Text>
          ))}
          <Text dimColor>{'─'.repeat(50)}</Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color={colors.warning}>
            No auto-install config detected. Manual setup may be required.
          </Text>
        </Box>
      )}

      {/* Long description preview */}
      {detail.longDescription && (
        <Box marginBottom={1}>
          <Text dimColor>
            {detail.longDescription.length > 300
              ? detail.longDescription.slice(0, 297) + '...'
              : detail.longDescription}
          </Text>
        </Box>
      )}

      {/* Action hints */}
      <Box flexDirection="row" gap={2}>
        {detail.standardConfig && (
          <Box>
            <Text inverse bold>{' Enter '}</Text>
            <Text dimColor> install</Text>
          </Box>
        )}
        <Box>
          <Text inverse bold>{' Esc '}</Text>
          <Text dimColor> back</Text>
        </Box>
      </Box>
    </Box>
  )
}

export default ServerDetailPane
