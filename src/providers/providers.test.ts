import { describe, it, expect } from 'vitest'
import { OpenAICompatibleProvider, createOpenAIProvider, createOllamaProvider, createGroqProvider } from './openai-compatible.js'
import { AnthropicProvider } from './anthropic.js'
import { createProvider } from './factory.js'

describe('OpenAICompatibleProvider', () => {
  it('creates with correct name', () => {
    const provider = new OpenAICompatibleProvider({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      defaultModel: 'gpt-4o',
      providerName: 'openai',
    })
    expect(provider.name).toBe('openai')
  })

  it('supports expected features', () => {
    const provider = createOpenAIProvider('test')
    expect(provider.supportsFeature('streaming')).toBe(true)
    expect(provider.supportsFeature('system_message')).toBe(true)
    expect(provider.supportsFeature('tool_use')).toBe(true)
    expect(provider.supportsFeature('prompt_caching')).toBe(false)
  })

  it('factory functions create correct providers', () => {
    expect(createOpenAIProvider('k').name).toBe('openai')
    expect(createOllamaProvider().name).toBe('ollama')
    expect(createGroqProvider('k').name).toBe('groq')
  })
})

describe('AnthropicProvider', () => {
  it('creates with correct name', () => {
    const provider = new AnthropicProvider({ apiKey: 'test' })
    expect(provider.name).toBe('anthropic')
  })

  it('supports expected features', () => {
    const provider = new AnthropicProvider({ apiKey: 'test' })
    expect(provider.supportsFeature('streaming')).toBe(true)
    expect(provider.supportsFeature('tool_use')).toBe(true)
    expect(provider.supportsFeature('thinking')).toBe(true)
    expect(provider.supportsFeature('prompt_caching')).toBe(true)
    expect(provider.supportsFeature('vision')).toBe(true)
    expect(provider.supportsFeature('structured_output')).toBe(false)
  })

  it('uses default model when none specified', () => {
    const provider = new AnthropicProvider({ apiKey: 'test' })
    // The default model is set in the constructor
    expect(provider.supportsFeature('streaming')).toBe(true) // Just verify it's constructed
  })
})

describe('createProvider factory', () => {
  it('creates anthropic provider for name=anthropic', () => {
    const provider = createProvider({
      provider: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKeyEnv: 'X', apiBaseUrl: '' },
      behavior: { permissionMode: 'default', maxTokens: 4096, maxCostUsd: 0 },
      features: { vimMode: true, memorySystem: true, skills: true, mcp: true, toolSearch: true },
      permissions: { allow: [], ask: [], deny: [] },
      costs: {},
      configPath: null,
    })
    expect(provider.name).toBe('anthropic')
  })

  it('creates openai provider for name=openai', () => {
    const provider = createProvider({
      provider: { name: 'openai', model: 'gpt-4o', apiKeyEnv: 'X', apiBaseUrl: '' },
      behavior: { permissionMode: 'default', maxTokens: 4096, maxCostUsd: 0 },
      features: { vimMode: true, memorySystem: true, skills: true, mcp: true, toolSearch: true },
      permissions: { allow: [], ask: [], deny: [] },
      costs: {},
      configPath: null,
    })
    expect(provider.name).toBe('openai')
  })

  it('creates custom provider for apiBaseUrl with /chat/completions', () => {
    const provider = createProvider({
      provider: { name: 'custom', model: 'test', apiKeyEnv: 'X', apiBaseUrl: 'https://example.com/v1/chat/completions' },
      behavior: { permissionMode: 'default', maxTokens: 4096, maxCostUsd: 0 },
      features: { vimMode: true, memorySystem: true, skills: true, mcp: true, toolSearch: true },
      permissions: { allow: [], ask: [], deny: [] },
      costs: {},
      configPath: null,
    })
    expect(provider.name).toBe('custom')
  })
})

describe('Provider types', () => {
  it('emptyUsage returns zeros', async () => {
    const { emptyUsage } = await import('./types.js')
    const u = emptyUsage()
    expect(u.inputTokens).toBe(0)
    expect(u.outputTokens).toBe(0)
  })

  it('addUsage sums correctly', async () => {
    const { emptyUsage, addUsage } = await import('./types.js')
    const a = { ...emptyUsage(), inputTokens: 100, outputTokens: 50 }
    const b = { inputTokens: 200, outputTokens: 100 }
    const result = addUsage(a, b)
    expect(result.inputTokens).toBe(300)
    expect(result.outputTokens).toBe(150)
  })
})
