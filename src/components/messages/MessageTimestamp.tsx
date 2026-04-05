/**
 * MessageTimestamp — Relative time display for messages.
 *
 * Shows timestamps as "just now", "2m ago", "1h ago", "2d ago".
 * Updates periodically to stay current.
 */

import React, { useState } from 'react'
import { Text } from 'ink'
import { useInterval } from '../../ink/hooks/useInterval.js'

// ============================================================================
// Types
// ============================================================================

export interface MessageTimestampProps {
  timestamp: number
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Update interval: every 30 seconds
const UPDATE_INTERVAL = 30_000

// ============================================================================
// MessageTimestamp Component
// ============================================================================

export const MessageTimestamp: React.FC<MessageTimestampProps> = ({ timestamp }) => {
  const [, setTick] = useState(0)

  // Force re-render periodically so relative time stays accurate
  useInterval(() => {
    setTick((prev) => prev + 1)
  }, UPDATE_INTERVAL)

  const relativeTime = formatRelativeTime(timestamp)

  return (
    <Text dimColor>{relativeTime}</Text>
  )
}

export default MessageTimestamp
