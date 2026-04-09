/**
 * InstallConfirmDialog — Confirmation before installing an MCP server.
 *
 * Shows what will be installed (server name, command, package), where it
 * will be written (.mcp.json or ~/.kite/config.json), and Allow / Deny
 * buttons. Follows the same interaction pattern as PermissionRequest.
 *
 * @example
 * <InstallConfirmDialog
 *   serverName="playwright"
 *   command="npx"
 *   args={['@playwright/mcp@latest']}
 *   configPath="/project/.mcp.json"
 *   isOpen={true}
 *   onConfirm={() => doInstall()}
 *   onCancel={() => goBack()}
 * />
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstallConfirmDialogProps = {
  /** Server name that will be the key in mcpServers config. */
  serverName: string
  /** The command to run (e.g. "npx"). */
  command: string
  /** Command args (e.g. ["@playwright/mcp@latest"]). */
  args?: string[]
  /** NPM package name if known. */
  npmPackage?: string
  /** Where the config will be written. */
  configPath: string
  /** Whether the dialog is visible. */
  isOpen: boolean
  /** Called when the user confirms installation. */
  onConfirm: () => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Whether the dialog accepts input. @default true when isOpen */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InstallConfirmDialog({
  serverName,
  command,
  args = [],
  npmPackage,
  configPath,
  isOpen,
  onConfirm,
  onCancel,
  isActive,
}: InstallConfirmDialogProps): React.ReactElement | null {
  const colors = getActiveColors()
  const [focusedIdx, setFocusedIdx] = useState(0)
  const active = isActive ?? isOpen

  const CHOICES = [
    { key: 'install', label: 'Install', color: colors.success },
    { key: 'cancel', label: 'Cancel', color: colors.error },
  ]

  useInput(
    (input, key) => {
      if (!active) return

      if (key.leftArrow || key.rightArrow || key.tab) {
        setFocusedIdx(prev => (prev + 1) % CHOICES.length)
        return
      }
      if (key.return) {
        if (focusedIdx === 0) onConfirm()
        else onCancel()
        return
      }
      if (key.escape) {
        onCancel()
        return
      }
      if (input === 'y' || input === 'Y') {
        onConfirm()
        return
      }
      if (input === 'n' || input === 'N') {
        onCancel()
        return
      }
    },
    { isActive: active },
  )

  if (!isOpen) return null

  const fullCommand = [command, ...args].join(' ')

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      paddingX={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={colors.warning}>
          Install MCP Server
        </Text>
      </Box>

      {/* Details */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Box width={12}><Text dimColor>Server:</Text></Box>
          <Text bold>{serverName}</Text>
        </Box>
        <Box>
          <Box width={12}><Text dimColor>Command:</Text></Box>
          <Text>{fullCommand}</Text>
        </Box>
        {npmPackage && (
          <Box>
            <Box width={12}><Text dimColor>Package:</Text></Box>
            <Text>{npmPackage}</Text>
          </Box>
        )}
        <Box>
          <Box width={12}><Text dimColor>Config:</Text></Box>
          <Text>{configPath}</Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box flexDirection="row" gap={1}>
        {CHOICES.map((choice, i) => {
          const isFocused = i === focusedIdx
          return (
            <Text
              key={choice.key}
              inverse={isFocused}
              bold={isFocused}
              color={isFocused ? choice.color : undefined}
            >
              {' '}{choice.label}{' '}
            </Text>
          )
        })}
        <Text dimColor>  y/n</Text>
      </Box>
    </Box>
  )
}

export default InstallConfirmDialog
