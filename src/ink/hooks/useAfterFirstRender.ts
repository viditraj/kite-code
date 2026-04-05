/**
 * useAfterFirstRender — run a callback after the component mounts.
 *
 * Ported from Claude Code's useAfterFirstRender.ts.
 * Adapted for Kite: no Anthropic-specific env checks.
 * Optionally logs startup time to stderr if KITE_STARTUP_TIMING is set.
 */

import { useEffect } from 'react'

export function useAfterFirstRender(callback?: () => void): void {
  useEffect(() => {
    if (process.env.KITE_STARTUP_TIMING === '1') {
      process.stderr.write(
        `\nStartup time: ${Math.round(process.uptime() * 1000)}ms\n`,
      )
    }
    callback?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
