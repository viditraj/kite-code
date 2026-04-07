/**
 * NotificationToast — Auto-dismissing notification system.
 *
 * Shows brief, transient notifications that appear for a few seconds
 * then disappear. Used for events like "Agent completed", "Session saved",
 * "Context compacted" — instead of inline system messages.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text } from 'ink'
import { useInterval } from '../ink/hooks/useInterval.js'

// ============================================================================
// Types
// ============================================================================

export interface Notification {
  id: string
  text: string
  type: 'info' | 'success' | 'warning' | 'error'
  timeoutMs: number
  createdAt: number
}

export interface NotificationToastProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

// ============================================================================
// Constants
// ============================================================================

const ICONS: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✗',
}

const COLORS: Record<string, string> = {
  info: 'cyan',
  success: 'green',
  warning: 'yellow',
  error: 'red',
}

// ============================================================================
// NotificationToast Component
// ============================================================================

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  // Auto-dismiss expired notifications
  useInterval(() => {
    const now = Date.now()
    for (const n of notifications) {
      if (now - n.createdAt >= n.timeoutMs) {
        onDismiss(n.id)
      }
    }
  }, notifications.length > 0 ? 500 : null)

  if (notifications.length === 0) return null

  return (
    <Box flexDirection="column">
      {notifications.slice(0, 3).map((n) => (
        <Box key={n.id}>
          <Text color={COLORS[n.type] ?? 'gray'}>
            {ICONS[n.type] ?? '·'}{' '}
          </Text>
          <Text color={COLORS[n.type] ?? 'gray'}>
            {n.text}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

// ============================================================================
// Hook: useNotifications
// ============================================================================

let notificationCounter = 0

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((
    text: string,
    type: Notification['type'] = 'info',
    timeoutMs: number = 4000,
  ) => {
    const id = `notif-${++notificationCounter}`
    setNotifications(prev => [
      ...prev,
      { id, text, type, timeoutMs, createdAt: Date.now() },
    ])
    return id
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    addNotification,
    dismissNotification,
    dismissAll,
  }
}
