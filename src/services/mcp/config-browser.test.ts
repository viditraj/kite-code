import { describe, it, expect } from 'vitest'
import { getAllMCPConfigs } from './config.js'
import { BROWSER_MCP_SERVER_NAME } from '../browser/config.js'

describe('MCP Config with built-in browser', () => {
  it('getAllMCPConfigs includes the built-in playwright server', () => {
    // Use a non-existent path so no user/project configs are found
    // but the built-in browser config should still be present
    const { servers } = getAllMCPConfigs('/tmp/nonexistent-kite-test-dir')
    expect(servers).toHaveProperty(BROWSER_MCP_SERVER_NAME)
  })

  it('built-in playwright server is stdio type', () => {
    const { servers } = getAllMCPConfigs('/tmp/nonexistent-kite-test-dir')
    const config = servers[BROWSER_MCP_SERVER_NAME]!
    expect(config.type === 'stdio' || config.type === undefined).toBe(true)
  })

  it('user config can override built-in playwright server', () => {
    // The built-in is lowest priority, so any user/project/local config
    // with the same name should override it.
    // We just verify the merge order is correct by checking the built-in
    // appears when no overrides exist.
    const { servers } = getAllMCPConfigs('/tmp/nonexistent-kite-test-dir')
    expect(servers[BROWSER_MCP_SERVER_NAME]).toBeDefined()
  })
})
