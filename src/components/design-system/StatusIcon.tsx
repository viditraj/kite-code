/**
 * StatusIcon — Renders a coloured status indicator character.
 *
 * Maps status names to a single Unicode character with an appropriate colour:
 *   - success  -> green checkmark  (✓)
 *   - error    -> red cross        (✗)
 *   - warning  -> yellow warning   (⚠)
 *   - info     -> blue info        (ℹ)
 *   - pending  -> gray circle      (○)
 *   - running  -> cyan spinner     (⟳)
 *
 * @example
 * <StatusIcon status="success" />
 * <Text><StatusIcon status="error" /> Operation failed</Text>
 */

import React from 'react'
import { Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatusIconStatus =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'pending'
  | 'running'

export type StatusIconProps = {
  /** Status to display. Determines both icon and colour. */
  status: StatusIconStatus
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type StatusConfig = {
  icon: string
  color: string | undefined
  dimColor?: boolean
}

const STATUS_CONFIG: Record<StatusIconStatus, StatusConfig> = {
  success: { icon: '\u2713', color: 'green' },       // ✓
  error:   { icon: '\u2717', color: 'red' },          // ✗
  warning: { icon: '\u26A0', color: 'yellow' },       // ⚠
  info:    { icon: '\u2139', color: 'blue' },          // ℹ
  pending: { icon: '\u25CB', color: undefined, dimColor: true }, // ○ (gray/dim)
  running: { icon: '\u27F3', color: 'cyan' },          // ⟳
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusIcon({ status }: StatusIconProps): React.ReactElement {
  const config = STATUS_CONFIG[status]

  return (
    <Text color={config.color} dimColor={config.dimColor ?? false}>
      {config.icon}
    </Text>
  )
}

export default StatusIcon
