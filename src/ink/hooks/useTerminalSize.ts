/**
 * useTerminalSize hook — get current terminal dimensions.
 *
 * Wraps ink's useStdout to provide reactive terminal size,
 * matching Claude Code's useTerminalSize pattern.
 */

import { useStdout } from 'ink'
import { useState, useEffect } from 'react'

export interface TerminalSize {
  columns: number
  rows: number
}

/**
 * Returns current terminal dimensions, updating on resize.
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout()

  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  })

  useEffect(() => {
    if (!stdout) return

    const handleResize = () => {
      setSize({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      })
    }

    stdout.on('resize', handleResize)
    return () => { stdout.off('resize', handleResize) }
  }, [stdout])

  return size
}
