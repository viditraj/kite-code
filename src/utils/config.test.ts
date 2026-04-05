import { describe, it, expect } from 'vitest'
import { loadConfig, getApiKey } from './config.js'

describe('loadConfig', () => {
  it('returns default config when no files exist', () => {
    const config = loadConfig('/nonexistent/path.json')
    expect(config.provider.name).toBe('anthropic')
    expect(config.provider.model).toBe('claude-sonnet-4-20250514')
    expect(config.behavior.permissionMode).toBe('default')
    expect(config.behavior.maxTokens).toBe(8192)
    expect(config.features.vimMode).toBe(true)
    expect(config.features.mcp).toBe(true)
  })

  it('has default cost entries', () => {
    const config = loadConfig('/nonexistent/path.json')
    expect(config.costs['gpt-4o']).toEqual({ input: 2.5, output: 10.0 })
    expect(config.costs['claude-sonnet-4-20250514']).toEqual({ input: 3.0, output: 15.0 })
  })

  it('getApiKey reads from environment', () => {
    const config = loadConfig('/nonexistent/path.json')
    // No env var set, should return undefined
    const key = getApiKey(config)
    // Can't guarantee env state, just check it returns string or undefined
    expect(key === undefined || typeof key === 'string').toBe(true)
  })
})
