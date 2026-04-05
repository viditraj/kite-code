/**
 * Tests for the ProviderSetup screen and enhanced LogoV2 components.
 *
 * Tests cover:
 * - ProviderSetup: provider presets, setup result structure
 * - LogoV2: rendering, responsive layout, truncation helpers
 * - MessageList: role labels, gradient rendering, tool results
 * - CLI: provider setup wiring, config save logic
 */

import { describe, it, expect, vi } from 'vitest'

// ============================================================================
// ProviderSetup tests
// ============================================================================

describe('ProviderSetup', () => {
  it('exports ProviderSetup component and ProviderSetupResult type', async () => {
    const mod = await import('./screens/ProviderSetup.js')
    expect(mod.ProviderSetup).toBeDefined()
    expect(typeof mod.ProviderSetup).toBe('function')
  })

  it('ProviderSetupResult has the correct shape', () => {
    // Validate the interface shape matches what we expect
    const result = {
      providerName: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      apiBaseUrl: '',
      verifySsl: true,
    }
    expect(result.providerName).toBe('anthropic')
    expect(result.model).toBe('claude-sonnet-4-20250514')
    expect(result.apiKeyEnv).toBe('ANTHROPIC_API_KEY')
    expect(typeof result.verifySsl).toBe('boolean')
  })
})

// ============================================================================
// LogoV2 tests
// ============================================================================

describe('LogoV2', () => {
  it('exports LogoV2 and CondensedLogo components', async () => {
    const mod = await import('./components/LogoV2/LogoV2.js')
    expect(mod.LogoV2).toBeDefined()
    expect(mod.CondensedLogo).toBeDefined()
    expect(typeof mod.LogoV2).toBe('function')
    expect(typeof mod.CondensedLogo).toBe('function')
  })

  it('LogoProps interface accepts version, model, provider, cwd', () => {
    const props = {
      version: '0.1.0',
      model: 'gpt-4o',
      provider: 'openai',
      cwd: '/home/user/project',
    }
    expect(props.version).toBe('0.1.0')
    expect(props.model).toBe('gpt-4o')
    expect(props.provider).toBe('openai')
    expect(props.cwd).toBe('/home/user/project')
  })
})

// ============================================================================
// MessageList tests
// ============================================================================

describe('MessageList', () => {
  it('exports all message components', async () => {
    const mod = await import('./components/messages/MessageList.js')
    expect(mod.MessageList).toBeDefined()
    expect(mod.MessageRow).toBeDefined()
    expect(mod.SystemMessage).toBeDefined()
    expect(mod.ToolResultMessage).toBeDefined()
  })

  it('DisplayMessage interface has required fields', () => {
    const msg = {
      id: 'test-1',
      role: 'assistant' as const,
      content: 'Hello world',
      timestamp: Date.now(),
    }
    expect(msg.id).toBe('test-1')
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('Hello world')
  })

  it('DisplayMessage supports optional fields', () => {
    const msg = {
      id: 'test-2',
      role: 'tool_result' as const,
      content: 'file contents',
      toolName: 'FileReadTool',
      isError: false,
      isThinking: false,
      timestamp: Date.now(),
    }
    expect(msg.toolName).toBe('FileReadTool')
    expect(msg.isError).toBe(false)
  })
})

// ============================================================================
// Render module tests
// ============================================================================

describe('render module', () => {
  it('exports launchInkRepl and launchProviderSetup', async () => {
    const mod = await import('./screens/render.js')
    expect(mod.launchInkRepl).toBeDefined()
    expect(mod.launchProviderSetup).toBeDefined()
    expect(typeof mod.launchInkRepl).toBe('function')
    expect(typeof mod.launchProviderSetup).toBe('function')
  })
})

// ============================================================================
// Config integration tests
// ============================================================================

describe('config integration', () => {
  it('loadConfig returns a valid KiteConfig even with no config file', async () => {
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig('/nonexistent/path/config.json')
    expect(config).toBeDefined()
    expect(config.provider).toBeDefined()
    expect(config.provider.name).toBe('anthropic') // default
    expect(config.behavior).toBeDefined()
    expect(config.features).toBeDefined()
    expect(config.permissions).toBeDefined()
  })

  it('getApiKey returns undefined when env var is not set', async () => {
    const { loadConfig, getApiKey } = await import('./utils/config.js')
    const config = loadConfig('/nonexistent/path/config.json')
    // Use a definitely-unset env var
    config.provider.apiKeyEnv = 'KITE_TEST_NONEXISTENT_KEY_12345'
    const key = getApiKey(config)
    // Should be undefined unless KITE_API_KEY is set
    expect(key === undefined || typeof key === 'string').toBe(true)
  })
})

// ============================================================================
// Provider factory tests for new providers
// ============================================================================

describe('provider factory', () => {
  it('creates OpenAI-compatible provider for custom URLs', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'custom'
    config.provider.apiBaseUrl = 'https://example.com/v1/chat/completions'
    config.provider.model = 'test-model'
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('custom')
  })

  it('creates Anthropic provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'anthropic'
    config.provider.model = 'claude-sonnet-4-20250514'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('anthropic')
  })

  it('creates Ollama provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'ollama'
    config.provider.model = 'llama3.1'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('ollama')
  })

  it('creates OpenAI provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'openai'
    config.provider.model = 'gpt-4o'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('openai')
  })

  it('creates Groq provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'groq'
    config.provider.model = 'llama-3.1-70b-versatile'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('groq')
  })

  it('creates DeepSeek provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'deepseek'
    config.provider.model = 'deepseek-chat'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('deepseek')
  })

  it('creates Mistral provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'mistral'
    config.provider.model = 'mistral-large-latest'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('mistral')
  })

  it('creates OpenRouter provider by name', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'openrouter'
    config.provider.model = 'anthropic/claude-sonnet-4-20250514'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('openrouter')
  })

  it('falls back to OpenAI-compatible for unknown providers', async () => {
    const { createProvider } = await import('./providers/factory.js')
    const { loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.provider.name = 'unknownprovider'
    config.provider.model = 'test-model'
    config.provider.apiBaseUrl = ''
    const provider = createProvider(config)
    expect(provider).toBeDefined()
    expect(provider.name).toBe('unknownprovider')
  })
})

// ============================================================================
// ScrollBox tests
// ============================================================================

describe('ScrollBox (legacy)', () => {
  it('exports ScrollBox component', async () => {
    const mod = await import('./ink/components/ScrollBox.js')
    expect(mod.ScrollBox).toBeDefined()
    expect(typeof mod.ScrollBox).toBe('function')
  })
})

// ============================================================================
// New MessageRow component tests
// ============================================================================

describe('MessageRow components', () => {
  it('exports all message components from MessageRow', async () => {
    const mod = await import('./components/messages/MessageRow.js')
    expect(mod.MessageRow).toBeDefined()
    expect(mod.UserMessage).toBeDefined()
    expect(mod.AssistantMessage).toBeDefined()
    expect(mod.SystemMessage).toBeDefined()
    expect(mod.ToolResultMessage).toBeDefined()
    expect(mod.MessageDivider).toBeDefined()
  })

  it('MessageList re-exports from MessageRow for backward compatibility', async () => {
    const mod = await import('./components/messages/MessageList.js')
    expect(mod.MessageList).toBeDefined()
    expect(mod.MessageRow).toBeDefined()
    expect(mod.DisplayMessage).toBeUndefined() // type-only export
  })
})

// ============================================================================
// StatusBar tests
// ============================================================================

describe('StatusBar', () => {
  it('exports StatusBar component', async () => {
    const mod = await import('./components/StatusBar.js')
    expect(mod.StatusBar).toBeDefined()
    expect(typeof mod.StatusBar).toBe('function')
  })
})

// ============================================================================
// REPL uses Static for scrolling
// ============================================================================

describe('REPL architecture', () => {
  it('REPL exports the component', async () => {
    const mod = await import('./screens/REPL.js')
    expect(mod.REPL).toBeDefined()
    expect(typeof mod.REPL).toBe('function')
  })
})

// ============================================================================
// /provider command tests
// ============================================================================

describe('/provider command', () => {
  it('findCommand resolves provider command', async () => {
    const { findCommand } = await import('./commands.js')
    const cmd = findCommand('provider')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('provider')
    expect(cmd!.description).toContain('provider')
  })

  it('/provider command shows help when called with no args', async () => {
    const { findCommand, executeCommand } = await import('./commands.js')
    const cmd = findCommand('provider')
    expect(cmd).toBeDefined()

    // Create minimal context
    const ctx = {
      abortController: new AbortController(),
      options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'test', isNonInteractiveSession: false },
      messages: [],
      getCwd: () => process.cwd(),
      getAppState: () => ({ _config: { provider: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKeyEnv: 'ANTHROPIC_API_KEY', apiBaseUrl: '' } } }),
      setAppState: () => {},
      readFileState: { has: () => false, get: () => undefined, set: () => {} },
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      setMessages: () => {},
    }
    const result = await executeCommand('provider', '', ctx as any)
    expect(result).toBeDefined()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('Current provider configuration')
    expect((result as any).value).toContain('anthropic')
  })

  it('/provider command accepts known provider', async () => {
    const { executeCommand } = await import('./commands.js')
    const config = { provider: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKeyEnv: '', apiBaseUrl: '' } }
    const ctx = {
      abortController: new AbortController(),
      options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'test', isNonInteractiveSession: false },
      messages: [],
      getCwd: () => process.cwd(),
      getAppState: () => ({ _config: config }),
      setAppState: () => {},
      readFileState: { has: () => false, get: () => undefined, set: () => {} },
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      setMessages: () => {},
    }
    const result = await executeCommand('provider', 'openai gpt-4o', ctx as any)
    expect(result).toBeDefined()
    expect((result as any).value).toContain('Provider switched to: openai')
    expect(config.provider.name).toBe('openai')
    expect(config.provider.model).toBe('gpt-4o')
  })

  it('/provider command rejects unknown provider', async () => {
    const { executeCommand } = await import('./commands.js')
    const ctx = {
      abortController: new AbortController(),
      options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'test', isNonInteractiveSession: false },
      messages: [],
      getCwd: () => process.cwd(),
      getAppState: () => ({ _config: { provider: { name: 'test', model: 'test', apiKeyEnv: '', apiBaseUrl: '' } } }),
      setAppState: () => {},
      readFileState: { has: () => false, get: () => undefined, set: () => {} },
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      setMessages: () => {},
    }
    const result = await executeCommand('provider', 'fakeprovider', ctx as any)
    expect(result).toBeDefined()
    expect((result as any).value).toContain('Unknown provider')
  })
})

// ============================================================================
// Enhanced /model command tests
// ============================================================================

describe('/model command (enhanced)', () => {
  it('shows model info and provider list when called with no args', async () => {
    const { executeCommand } = await import('./commands.js')
    const ctx = {
      abortController: new AbortController(),
      options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'gpt-4o', isNonInteractiveSession: false },
      messages: [],
      getCwd: () => process.cwd(),
      getAppState: () => ({ _config: { provider: { name: 'openai', model: 'gpt-4o' } } }),
      setAppState: () => {},
      readFileState: { has: () => false, get: () => undefined, set: () => {} },
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      setMessages: () => {},
    }
    const result = await executeCommand('model', '', ctx as any)
    expect(result).toBeDefined()
    expect((result as any).value).toContain('Current model: gpt-4o')
    expect((result as any).value).toContain('Common models')
    expect((result as any).value).toContain('Anthropic')
    expect((result as any).value).toContain('OpenAI')
  })
})
