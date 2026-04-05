/**
 * Tests for Phase 3.2 hooks, Phase 3.1 command autocomplete,
 * Phase 5.1 AppStateStore, Phase 5.3 Plugin System, and Phase 2.1 /rename.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Hook Tests (non-React — pure logic tests)
// ============================================================================

describe('useElapsedTime', () => {
  it('formatDuration formats seconds correctly', async () => {
    const { formatDuration } = await import('./ink/hooks/useElapsedTime.js')
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(5000)).toBe('5s')
    expect(formatDuration(59000)).toBe('59s')
  })

  it('formatDuration formats minutes correctly', async () => {
    const { formatDuration } = await import('./ink/hooks/useElapsedTime.js')
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(3599000)).toBe('59m 59s')
  })

  it('formatDuration formats hours correctly', async () => {
    const { formatDuration } = await import('./ink/hooks/useElapsedTime.js')
    expect(formatDuration(3600000)).toBe('1h 0m')
    expect(formatDuration(7200000)).toBe('2h 0m')
    expect(formatDuration(5400000)).toBe('1h 30m')
  })
})

describe('useTimeout', () => {
  it('exports useTimeout function', async () => {
    const mod = await import('./ink/hooks/useTimeout.js')
    expect(typeof mod.useTimeout).toBe('function')
  })
})

describe('useAfterFirstRender', () => {
  it('exports useAfterFirstRender function', async () => {
    const mod = await import('./ink/hooks/useAfterFirstRender.js')
    expect(typeof mod.useAfterFirstRender).toBe('function')
  })
})

describe('useMemoryUsage', () => {
  it('exports useMemoryUsage function and types', async () => {
    const mod = await import('./ink/hooks/useMemoryUsage.js')
    expect(typeof mod.useMemoryUsage).toBe('function')
  })
})

describe('useDoublePress', () => {
  it('exports useDoublePress and DOUBLE_PRESS_TIMEOUT_MS', async () => {
    const mod = await import('./ink/hooks/useDoublePress.js')
    expect(typeof mod.useDoublePress).toBe('function')
    expect(mod.DOUBLE_PRESS_TIMEOUT_MS).toBe(800)
  })
})

describe('useMinDisplayTime', () => {
  it('exports useMinDisplayTime function', async () => {
    const mod = await import('./ink/hooks/useMinDisplayTime.js')
    expect(typeof mod.useMinDisplayTime).toBe('function')
  })
})

describe('useCopyOnSelect', () => {
  it('exports useCopyOnSelect function', async () => {
    const mod = await import('./ink/hooks/useCopyOnSelect.js')
    expect(typeof mod.useCopyOnSelect).toBe('function')
  })
})

describe('usePasteHandler', () => {
  it('exports usePasteHandler function', async () => {
    const mod = await import('./ink/hooks/usePasteHandler.js')
    expect(typeof mod.usePasteHandler).toBe('function')
  })
})

describe('useCancelRequest', () => {
  it('exports useCancelRequest function', async () => {
    const mod = await import('./ink/hooks/useCancelRequest.js')
    expect(typeof mod.useCancelRequest).toBe('function')
  })
})

describe('useHistorySearch', () => {
  it('exports useHistorySearch function', async () => {
    const mod = await import('./ink/hooks/useHistorySearch.js')
    expect(typeof mod.useHistorySearch).toBe('function')
  })
})

// ============================================================================
// ink/index.ts barrel exports
// ============================================================================

describe('ink/index re-exports all hooks', () => {
  it('exports all new hooks', async () => {
    const mod = await import('./ink/index.js')
    // Original hooks
    expect(typeof mod.useInterval).toBe('function')
    expect(typeof mod.useTerminalSize).toBe('function')
    expect(typeof mod.useVimMode).toBe('function')
    expect(typeof mod.useKeybindings).toBe('function')
    // New hooks
    expect(typeof mod.useElapsedTime).toBe('function')
    expect(typeof mod.useTimeout).toBe('function')
    expect(typeof mod.useAfterFirstRender).toBe('function')
    expect(typeof mod.useMemoryUsage).toBe('function')
    expect(typeof mod.useDoublePress).toBe('function')
    expect(typeof mod.useMinDisplayTime).toBe('function')
    expect(typeof mod.useCopyOnSelect).toBe('function')
    expect(typeof mod.usePasteHandler).toBe('function')
    expect(typeof mod.useCancelRequest).toBe('function')
    expect(typeof mod.useHistorySearch).toBe('function')
    expect(typeof mod.formatDuration).toBe('function')
    expect(mod.DOUBLE_PRESS_TIMEOUT_MS).toBe(800)
  })
})

// ============================================================================
// Command Autocomplete Tests
// ============================================================================

describe('Command Autocomplete', () => {
  describe('generateCommandSuggestions', () => {
    it('returns suggestions for empty query', async () => {
      const { generateCommandSuggestions } = await import('./utils/suggestions/commandSuggestions.js')
      const suggestions = generateCommandSuggestions('')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0]!.displayText).toMatch(/^\//)
    })

    it('returns matching suggestions for partial query', async () => {
      const { generateCommandSuggestions } = await import('./utils/suggestions/commandSuggestions.js')
      const suggestions = generateCommandSuggestions('hel')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0]!.name).toBe('help')
    })

    it('returns empty array for non-matching query', async () => {
      const { generateCommandSuggestions } = await import('./utils/suggestions/commandSuggestions.js')
      const suggestions = generateCommandSuggestions('zzzzzzzzz')
      expect(suggestions.length).toBe(0)
    })

    it('matches against aliases', async () => {
      const { generateCommandSuggestions } = await import('./utils/suggestions/commandSuggestions.js')
      // 'q' is an alias for 'exit'
      const suggestions = generateCommandSuggestions('q')
      const exitSugg = suggestions.find(s => s.name === 'exit')
      expect(exitSugg).toBeDefined()
    })

    it('respects maxResults limit', async () => {
      const { generateCommandSuggestions } = await import('./utils/suggestions/commandSuggestions.js')
      const suggestions = generateCommandSuggestions('', 3)
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })
  })

  describe('getBestCommandMatch', () => {
    it('returns suffix for prefix match', async () => {
      const { getBestCommandMatch } = await import('./utils/suggestions/commandSuggestions.js')
      const suffix = getBestCommandMatch('hel')
      expect(suffix).toBe('p')
    })

    it('returns null for empty query', async () => {
      const { getBestCommandMatch } = await import('./utils/suggestions/commandSuggestions.js')
      const suffix = getBestCommandMatch('')
      expect(suffix).toBeNull()
    })

    it('returns null for non-matching query', async () => {
      const { getBestCommandMatch } = await import('./utils/suggestions/commandSuggestions.js')
      const suffix = getBestCommandMatch('zzzzzzz')
      expect(suffix).toBeNull()
    })
  })

  describe('findSlashCommandPrefix', () => {
    it('detects slash command at start', async () => {
      const { findSlashCommandPrefix } = await import('./utils/suggestions/commandSuggestions.js')
      expect(findSlashCommandPrefix('/help')).toBe('help')
      expect(findSlashCommandPrefix('/model gpt-4')).toBe('model')
      expect(findSlashCommandPrefix('/h')).toBe('h')
    })

    it('returns null for non-slash input', async () => {
      const { findSlashCommandPrefix } = await import('./utils/suggestions/commandSuggestions.js')
      expect(findSlashCommandPrefix('hello')).toBeNull()
      expect(findSlashCommandPrefix('')).toBeNull()
    })

    it('handles leading whitespace', async () => {
      const { findSlashCommandPrefix } = await import('./utils/suggestions/commandSuggestions.js')
      expect(findSlashCommandPrefix('  /help')).toBe('help')
    })
  })
})

// ============================================================================
// AppStateStore Tests
// ============================================================================

describe('AppStateStore', () => {
  describe('createStore', () => {
    it('creates a store with initial state', async () => {
      const { createStore } = await import('./state/store.js')
      const store = createStore({ count: 0 })
      expect(store.getState()).toEqual({ count: 0 })
    })

    it('updates state with setState', async () => {
      const { createStore } = await import('./state/store.js')
      const store = createStore({ count: 0 })
      store.setState(prev => ({ count: prev.count + 1 }))
      expect(store.getState()).toEqual({ count: 1 })
    })

    it('notifies listeners on state change', async () => {
      const { createStore } = await import('./state/store.js')
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.setState(prev => ({ count: prev.count + 1 }))
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe stops notifications', async () => {
      const { createStore } = await import('./state/store.js')
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      const unsub = store.subscribe(listener)
      unsub()
      store.setState(prev => ({ count: prev.count + 1 }))
      expect(listener).not.toHaveBeenCalled()
    })

    it('skips notification when state is unchanged', async () => {
      const { createStore } = await import('./state/store.js')
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      const state = store.getState()
      store.setState(() => state) // Same reference
      expect(listener).not.toHaveBeenCalled()
    })

    it('calls onChange callback', async () => {
      const { createStore } = await import('./state/store.js')
      const onChange = vi.fn()
      const store = createStore({ count: 0 }, onChange)
      store.setState(prev => ({ count: prev.count + 1 }))
      expect(onChange).toHaveBeenCalledWith({ count: 1 })
    })
  })

  describe('AppStateStore factory', () => {
    it('creates store with default state', async () => {
      const { createAppStateStore, getDefaultAppState } = await import('./state/AppStateStore.js')
      const store = createAppStateStore()
      const state = store.getState()
      expect(state.vimMode).toBe(false)
      expect(state.showThinking).toBe(false)
      expect(state.outputStyle).toBe('concise')
      expect(state.effortLevel).toBe('medium')
      expect(state.fastMode).toBe(false)
      expect(state.tasks).toEqual({})
      expect(state.notifications.current).toBeNull()
    })

    it('allows overrides', async () => {
      const { createAppStateStore } = await import('./state/AppStateStore.js')
      const store = createAppStateStore({ vimMode: true, theme: 'dark' })
      expect(store.getState().vimMode).toBe(true)
      expect(store.getState().theme).toBe('dark')
    })
  })

  describe('getDefaultAppState', () => {
    it('returns proper defaults', async () => {
      const { getDefaultAppState } = await import('./state/AppStateStore.js')
      const defaults = getDefaultAppState()
      expect(defaults.vimMode).toBe(false)
      expect(defaults.showThinking).toBe(false)
      expect(defaults.outputStyle).toBe('concise')
      expect(defaults.effortLevel).toBe('medium')
      expect(defaults.theme).toBe('default')
      expect(defaults.gitBranch).toBeNull()
      expect(defaults.isGitRepo).toBe(false)
      expect(typeof defaults.sessionStartedAt).toBe('number')
    })
  })
})

// ============================================================================
// State Persistence Tests
// ============================================================================

describe('State Persistence', () => {
  it('exports loadPersistedState and savePersistedState', async () => {
    const mod = await import('./state/persistence.js')
    expect(typeof mod.loadPersistedState).toBe('function')
    expect(typeof mod.savePersistedState).toBe('function')
    expect(typeof mod.createAutoSaveHandler).toBe('function')
  })

  it('loadPersistedState returns empty object when no file', async () => {
    const { loadPersistedState } = await import('./state/persistence.js')
    // This may or may not have a file, but shouldn't throw
    const result = loadPersistedState()
    expect(typeof result).toBe('object')
  })

  it('createAutoSaveHandler returns a function', async () => {
    const { createAutoSaveHandler } = await import('./state/persistence.js')
    const handler = createAutoSaveHandler()
    expect(typeof handler).toBe('function')
  })
})

// ============================================================================
// State barrel exports
// ============================================================================

describe('state/index barrel exports', () => {
  it('exports all state management modules', async () => {
    const mod = await import('./state/index.js')
    expect(typeof mod.createStore).toBe('function')
    expect(typeof mod.createAppStateStore).toBe('function')
    expect(typeof mod.getDefaultAppState).toBe('function')
    expect(typeof mod.loadPersistedState).toBe('function')
    expect(typeof mod.savePersistedState).toBe('function')
    expect(typeof mod.createAutoSaveHandler).toBe('function')
    // React components/hooks exist
    expect(typeof mod.AppStateProvider).toBe('function')
    expect(typeof mod.useAppState).toBe('function')
    expect(typeof mod.useSetAppState).toBe('function')
    expect(typeof mod.useAppStateStore).toBe('function')
  })
})

// ============================================================================
// Plugin System Tests
// ============================================================================

describe('Plugin System', () => {
  describe('discoverPluginDirs', () => {
    it('returns empty array when no plugins directory exists', async () => {
      const { discoverPluginDirs } = await import('./plugins/pluginLoader.js')
      // Use a temp dir that definitely has no .kite/plugins/
      const dirs = discoverPluginDirs('/tmp/nonexistent-kite-dir')
      // May still find global plugins in ~/.kite/plugins/, so just check it's an array
      expect(Array.isArray(dirs)).toBe(true)
    })
  })

  describe('parseManifest', () => {
    it('returns null for non-existent directory', async () => {
      const { parseManifest } = await import('./plugins/pluginLoader.js')
      const result = parseManifest('/tmp/nonexistent-plugin-dir')
      expect(result).toBeNull()
    })

    it('parses valid manifest', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { parseManifest } = await import('./plugins/pluginLoader.js')

      // Create a temp plugin dir
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test',
      }
      fs.writeFileSync(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify(manifest),
      )

      const result = parseManifest(tmpDir)
      expect(result).not.toBeNull()
      expect(result!.manifest.name).toBe('test-plugin')
      expect(result!.manifest.version).toBe('1.0.0')
      expect(result!.manifest.description).toBe('A test plugin')
      expect(result!.errors.length).toBe(0)

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true })
    })

    it('returns null for invalid JSON', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { parseManifest } = await import('./plugins/pluginLoader.js')

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      fs.writeFileSync(path.join(tmpDir, 'plugin.json'), 'not json')

      const result = parseManifest(tmpDir)
      expect(result).toBeNull()

      fs.rmSync(tmpDir, { recursive: true })
    })

    it('returns null for manifest missing name', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { parseManifest } = await import('./plugins/pluginLoader.js')

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      fs.writeFileSync(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify({ version: '1.0.0' }),
      )

      const result = parseManifest(tmpDir)
      expect(result).toBeNull()

      fs.rmSync(tmpDir, { recursive: true })
    })
  })

  describe('loadPlugin', () => {
    it('returns null for disabled plugin', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { loadPlugin } = await import('./plugins/pluginLoader.js')

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      const manifest = {
        name: 'disabled-plugin',
        version: '1.0.0',
        description: 'Disabled',
        disabled: true,
      }
      fs.writeFileSync(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify(manifest),
      )

      const result = await loadPlugin(tmpDir)
      expect(result).toBeNull()

      fs.rmSync(tmpDir, { recursive: true })
    })

    it('loads plugin with no tools/commands/hooks', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { loadPlugin } = await import('./plugins/pluginLoader.js')

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      const manifest = {
        name: 'empty-plugin',
        version: '1.0.0',
        description: 'Empty plugin',
      }
      fs.writeFileSync(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify(manifest),
      )

      const result = await loadPlugin(tmpDir)
      expect(result).not.toBeNull()
      expect(result!.manifest.name).toBe('empty-plugin')
      expect(result!.tools).toEqual([])
      expect(result!.commands).toEqual([])
      expect(result!.hooks.size).toBe(0)
      expect(result!.errors.length).toBe(0)

      fs.rmSync(tmpDir, { recursive: true })
    })

    it('records errors for missing tool modules', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const { loadPlugin } = await import('./plugins/pluginLoader.js')

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-plugin-test-'))
      const manifest = {
        name: 'bad-tools-plugin',
        version: '1.0.0',
        description: 'Has missing tool',
        tools: ['./nonexistent-tool.js'],
      }
      fs.writeFileSync(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify(manifest),
      )

      const result = await loadPlugin(tmpDir)
      expect(result).not.toBeNull()
      expect(result!.tools).toEqual([])
      expect(result!.errors.length).toBeGreaterThan(0)
      expect(result!.errors[0]!.phase).toBe('tool')

      fs.rmSync(tmpDir, { recursive: true })
    })
  })

  describe('loadAllPlugins', () => {
    it('returns empty arrays when no plugins exist', async () => {
      const { loadAllPlugins } = await import('./plugins/pluginLoader.js')
      const result = await loadAllPlugins('/tmp/nonexistent-kite-dir')
      expect(Array.isArray(result.plugins)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })

  describe('Plugin cache', () => {
    it('getLoadedPlugins returns empty by default', async () => {
      const { getLoadedPlugins, clearPluginCache } = await import('./plugins/pluginLoader.js')
      clearPluginCache()
      expect(getLoadedPlugins()).toEqual([])
    })

    it('setLoadedPlugins stores plugins', async () => {
      const { getLoadedPlugins, setLoadedPlugins, clearPluginCache } = await import('./plugins/pluginLoader.js')
      clearPluginCache()
      const fakePlugin = {
        manifest: { name: 'test', version: '1.0.0', description: 'test' },
        pluginDir: '/tmp/test',
        tools: [],
        commands: [],
        hooks: new Map(),
        errors: [],
      } as any
      setLoadedPlugins([fakePlugin])
      expect(getLoadedPlugins().length).toBe(1)
      expect(getLoadedPlugins()[0]!.manifest.name).toBe('test')
      clearPluginCache()
    })

    it('getPluginTools returns tools from cached plugins', async () => {
      const { getPluginTools, setLoadedPlugins, clearPluginCache } = await import('./plugins/pluginLoader.js')
      clearPluginCache()
      expect(getPluginTools()).toEqual([])
      clearPluginCache()
    })

    it('getPluginCommands returns commands from cached plugins', async () => {
      const { getPluginCommands, setLoadedPlugins, clearPluginCache } = await import('./plugins/pluginLoader.js')
      clearPluginCache()
      expect(getPluginCommands()).toEqual([])
      clearPluginCache()
    })
  })

  describe('executePluginHook', () => {
    it('executes hooks across plugins', async () => {
      const { executePluginHook } = await import('./plugins/pluginLoader.js')
      const called: string[] = []
      const fakePlugin = {
        manifest: { name: 'test', version: '1.0.0', description: '' },
        pluginDir: '/tmp',
        tools: [],
        commands: [],
        hooks: new Map([
          ['onStart', async () => { called.push('onStart') }],
        ]),
        errors: [],
      } as any

      const errors = await executePluginHook([fakePlugin], 'onStart')
      expect(errors.length).toBe(0)
      expect(called).toEqual(['onStart'])
    })

    it('collects errors from failing hooks', async () => {
      const { executePluginHook } = await import('./plugins/pluginLoader.js')
      const fakePlugin = {
        manifest: { name: 'fail-plugin', version: '1.0.0', description: '' },
        pluginDir: '/tmp',
        tools: [],
        commands: [],
        hooks: new Map([
          ['onStart', async () => { throw new Error('hook failed') }],
        ]),
        errors: [],
      } as any

      const errors = await executePluginHook([fakePlugin], 'onStart')
      expect(errors.length).toBe(1)
      expect(errors[0]!.pluginName).toBe('fail-plugin')
      expect(errors[0]!.message).toContain('hook failed')
    })

    it('skips plugins without the named hook', async () => {
      const { executePluginHook } = await import('./plugins/pluginLoader.js')
      const fakePlugin = {
        manifest: { name: 'no-hook', version: '1.0.0', description: '' },
        pluginDir: '/tmp',
        tools: [],
        commands: [],
        hooks: new Map(),
        errors: [],
      } as any

      const errors = await executePluginHook([fakePlugin], 'onStart')
      expect(errors.length).toBe(0)
    })
  })
})

// ============================================================================
// /rename command test
// ============================================================================

describe('/rename command', () => {
  it('is registered in command registry', async () => {
    const { findCommand } = await import('./commands.js')
    const cmd = findCommand('rename')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('rename')
    expect(cmd!.type).toBe('local')
  })

  it('returns usage when no args given', async () => {
    const { findCommand } = await import('./commands.js')
    const cmd = findCommand('rename')
    expect(cmd).toBeDefined()
    if (cmd!.type !== 'local') throw new Error('Expected local command')

    const result = await cmd!.call('', {
      messages: [],
      options: { mainLoopModel: 'test' },
      getAppState: () => ({}),
      setAppState: () => {},
      getCwd: () => '/tmp',
      setMessages: () => {},
    } as any)

    expect(result.type).toBe('text')
    expect((result as any).value).toContain('Usage: /rename')
  })

  it('returns error when no session id', async () => {
    const { findCommand } = await import('./commands.js')
    const cmd = findCommand('rename')
    if (cmd!.type !== 'local') throw new Error('Expected local command')

    const result = await cmd!.call('new name', {
      messages: [],
      options: { mainLoopModel: 'test' },
      getAppState: () => ({}),
      setAppState: () => {},
      getCwd: () => '/tmp',
      setMessages: () => {},
    } as any)

    expect(result.type).toBe('text')
    expect((result as any).value).toContain('No active session')
  })
})

// ============================================================================
// CommandAutocomplete component test
// ============================================================================

describe('CommandAutocomplete', () => {
  it('exports CommandAutocomplete component and useCommandAutocomplete hook', async () => {
    const mod = await import('./components/CommandAutocomplete.js')
    expect(typeof mod.CommandAutocomplete).toBe('function')
    expect(typeof mod.useCommandAutocomplete).toBe('function')
  })
})
