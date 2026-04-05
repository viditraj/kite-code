import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getBuiltinBrowserConfig, isPlaywrightMcpAvailable, BROWSER_MCP_SERVER_NAME } from './config.js'

// ============================================================================
// Browser Config tests
// ============================================================================

describe('Browser MCP Config', () => {
  describe('BROWSER_MCP_SERVER_NAME', () => {
    it('is "playwright"', () => {
      expect(BROWSER_MCP_SERVER_NAME).toBe('playwright')
    })
  })

  describe('isPlaywrightMcpAvailable', () => {
    it('returns true when @playwright/mcp is installed', () => {
      // @playwright/mcp is a project dependency, so it should be available
      expect(isPlaywrightMcpAvailable()).toBe(true)
    })
  })

  describe('getBuiltinBrowserConfig', () => {
    it('returns a config entry for the playwright server', () => {
      const configs = getBuiltinBrowserConfig()
      expect(configs).toHaveProperty(BROWSER_MCP_SERVER_NAME)
    })

    it('configures stdio transport', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]!
      expect(config.type).toBe('stdio')
    })

    it('includes --headless flag', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]! as { args?: string[] }
      expect(config.args).toContain('--headless')
    })

    it('includes --caps vision flag', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]! as { args?: string[] }
      expect(config.args).toContain('--caps')
      expect(config.args).toContain('vision')
    })

    it('includes --browser chromium flag', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]! as { args?: string[] }
      expect(config.args).toContain('--browser')
      expect(config.args).toContain('chromium')
    })

    it('sets scope to local', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]!
      expect(config.scope).toBe('local')
    })

    it('points to a valid command', () => {
      const configs = getBuiltinBrowserConfig()
      const config = configs[BROWSER_MCP_SERVER_NAME]! as { command: string }
      // Should be an absolute path to the local bin or npx
      expect(typeof config.command).toBe('string')
      expect(config.command.length).toBeGreaterThan(0)
    })
  })
})
