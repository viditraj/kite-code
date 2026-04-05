/**
 * useCancelRequest — unified cancel/interrupt handler.
 *
 * Adapted from Claude Code's useCancelRequest.ts for Kite.
 * Manages cancel logic with priority ordering:
 * 1. Cancel running LLM request (if streaming)
 * 2. Pop queued commands
 * 3. Clear tool confirmation queue
 *
 * Integrates with the Escape key and Ctrl+C keybindings.
 */

import { useCallback, useRef } from 'react'
import { useInput } from 'ink'

export interface CancelRequestOptions {
  /** AbortController for the current LLM request */
  abortController?: AbortController
  /** Callback when a cancel is triggered */
  onCancel: () => void
  /** Whether the cancel handler should listen for input */
  isActive: boolean
  /** Callback to clear tool confirmation queue */
  clearToolConfirmQueue?: () => void
  /** Whether the model is currently streaming */
  isStreaming?: boolean
  /** Optional callback for first press of double-press pattern */
  onFirstPress?: () => void
  /** Time window for double-press to exit (ms) */
  doublePressTimeoutMs?: number
  /** Callback when double-press is detected (e.g., exit app) */
  onDoublePress?: () => void
}

export interface CancelRequestResult {
  /** Whether a cancel is pending (first press, waiting for second) */
  isPending: boolean
  /** Trigger cancel programmatically */
  cancel: () => void
}

const DEFAULT_DOUBLE_PRESS_TIMEOUT_MS = 800

export function useCancelRequest(
  options: CancelRequestOptions,
): CancelRequestResult {
  const {
    abortController,
    onCancel,
    isActive,
    clearToolConfirmQueue,
    isStreaming = false,
    onFirstPress,
    doublePressTimeoutMs = DEFAULT_DOUBLE_PRESS_TIMEOUT_MS,
    onDoublePress,
  } = options

  const lastPressRef = useRef<number>(0)
  const pendingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancel = useCallback(() => {
    // Priority 1: Cancel running LLM request
    if (abortController && !abortController.signal.aborted) {
      clearToolConfirmQueue?.()
      abortController.abort()
      onCancel()
      return
    }

    // Priority 2: Clear tool confirm queue
    if (clearToolConfirmQueue) {
      clearToolConfirmQueue()
    }

    // Priority 3: General cancel
    onCancel()
  }, [abortController, onCancel, clearToolConfirmQueue])

  const handlePress = useCallback(() => {
    // If streaming, immediately cancel
    if (isStreaming) {
      cancel()
      return
    }

    // Double-press pattern for exit
    if (onDoublePress) {
      const now = Date.now()
      const timeSinceLastPress = now - lastPressRef.current
      const isDoublePress =
        timeSinceLastPress <= doublePressTimeoutMs &&
        timeoutRef.current !== undefined

      if (isDoublePress) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
        pendingRef.current = false
        onDoublePress()
      } else {
        onFirstPress?.()
        pendingRef.current = true

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          pendingRef.current = false
          timeoutRef.current = undefined
        }, doublePressTimeoutMs)
      }

      lastPressRef.current = now
      return
    }

    // Simple cancel
    cancel()
  }, [isStreaming, cancel, onDoublePress, onFirstPress, doublePressTimeoutMs])

  // Listen for Escape and Ctrl+C
  useInput(
    (input, key) => {
      if (key.escape) {
        handlePress()
      } else if (key.ctrl && input === 'c') {
        handlePress()
      }
    },
    { isActive },
  )

  return {
    isPending: pendingRef.current,
    cancel,
  }
}
