/**
 * useDoublePress — detect a rapid double-press of a key.
 *
 * Ported from Claude Code's useDoublePress.ts.
 * Creates a handler that calls one function on the first press and another
 * function on the second press within a configurable timeout window.
 *
 * Used for patterns like "press Escape once to show hint, twice to cancel".
 */

import { useCallback, useEffect, useRef } from 'react'

export const DOUBLE_PRESS_TIMEOUT_MS = 800

/**
 * Returns a press handler function.
 *
 * @param setPending - Called with true on first press, false after timeout or second press
 * @param onDoublePress - Called on the second press within the timeout window
 * @param onFirstPress - Optional callback for the first press
 */
export function useDoublePress(
  setPending: (pending: boolean) => void,
  onDoublePress: () => void,
  onFirstPress?: () => void,
): () => void {
  const lastPressRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearTimeoutSafe = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeoutSafe()
    }
  }, [clearTimeoutSafe])

  return useCallback(() => {
    const now = Date.now()
    const timeSinceLastPress = now - lastPressRef.current
    const isDoublePress =
      timeSinceLastPress <= DOUBLE_PRESS_TIMEOUT_MS &&
      timeoutRef.current !== undefined

    if (isDoublePress) {
      // Double press detected
      clearTimeoutSafe()
      setPending(false)
      onDoublePress()
    } else {
      // First press
      onFirstPress?.()
      setPending(true)

      // Clear any existing timeout and set new one
      clearTimeoutSafe()
      timeoutRef.current = setTimeout(() => {
        setPending(false)
        timeoutRef.current = undefined
      }, DOUBLE_PRESS_TIMEOUT_MS)
    }

    lastPressRef.current = now
  }, [setPending, onDoublePress, onFirstPress, clearTimeoutSafe])
}
