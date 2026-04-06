/**
 * Built-in Playwright MCP browser server configuration.
 *
 * Provides the default MCP server config for @playwright/mcp so that
 * Kite has browser access out-of-the-box.  The server is registered as
 * a built-in with scope 'local' and can be overridden or disabled by
 * the user's own MCP config (project or user scope).
 *
 * The server runs `playwright-mcp` in headless mode with vision
 * capabilities enabled so that screenshots are returned as images.
 */

import { resolve, join } from 'path'
import { existsSync } from 'fs'
import type { ScopedMCPServerConfig } from '../mcp/types.js'

// ============================================================================
// Constants
// ============================================================================

export const BROWSER_MCP_SERVER_NAME = 'playwright'

/**
 * Resolve the path to the playwright-mcp CLI binary.
 *
 * Checks (in order):
 *   1. Local node_modules/.bin/playwright-mcp  (installed as dependency)
 *   2. Falls back to bare 'npx @playwright/mcp' invocation
 */
function resolvePlaywrightMcpBin(): { command: string; args: string[] } {
  // Try local bin first
  const localBin = resolve(
    import.meta.dirname ?? process.cwd(),
    '..', '..', '..', 'node_modules', '.bin', 'playwright-mcp',
  )
  if (existsSync(localBin)) {
    return { command: localBin, args: [] }
  }

  // Fallback: npx
  return { command: 'npx', args: ['@playwright/mcp'] }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether the @playwright/mcp package is available.
 */
export function isPlaywrightMcpAvailable(): boolean {
  try {
    const localBin = resolve(
      import.meta.dirname ?? process.cwd(),
      '..', '..', '..', 'node_modules', '.bin', 'playwright-mcp',
    )
    return existsSync(localBin)
  } catch {
    return false
  }
}

/**
 * Get the built-in Playwright MCP server configuration.
 *
 * Returns the config entry suitable for merging into the MCP server map.
 * The server runs in headless mode with the `--caps vision` flag so that
 * `browser_take_screenshot` returns base64 image data.
 */
export function getBuiltinBrowserConfig(): Record<string, ScopedMCPServerConfig> {
  if (!isPlaywrightMcpAvailable()) {
    return {}
  }

  const { command, args } = resolvePlaywrightMcpBin()

  const config: ScopedMCPServerConfig = {
    type: 'stdio',
    command,
    args: [
      ...args,
      '--headless',
      '--caps', 'vision',
      '--browser', 'chromium',
      '--no-sandbox',
      '--ignore-https-errors',
    ],
    scope: 'local',
  }

  return { [BROWSER_MCP_SERVER_NAME]: config }
}
