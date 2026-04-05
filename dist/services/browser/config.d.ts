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
import type { ScopedMCPServerConfig } from '../mcp/types.js';
export declare const BROWSER_MCP_SERVER_NAME = "playwright";
/**
 * Check whether the @playwright/mcp package is available.
 */
export declare function isPlaywrightMcpAvailable(): boolean;
/**
 * Get the built-in Playwright MCP server configuration.
 *
 * Returns the config entry suitable for merging into the MCP server map.
 * The server runs in headless mode with the `--caps vision` flag so that
 * `browser_take_screenshot` returns base64 image data.
 */
export declare function getBuiltinBrowserConfig(): Record<string, ScopedMCPServerConfig>;
//# sourceMappingURL=config.d.ts.map