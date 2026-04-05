import { describe, it, expect } from 'vitest'
import {
  getCommands,
  findCommand,
  executeCommand,
  getCommandNames,
  builtInCommandNames,
  clearCommandsCache,
  registerCommand,
  getCommandName,
  isCommandEnabled,
} from '../commands.js'
import type { LocalCommandContext } from '../types/command.js'

function mockCommandContext(): LocalCommandContext {
  const state: Record<string, unknown> = {}
  return {
    abortController: new AbortController(),
    options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'mock', isNonInteractiveSession: false },
    messages: [],
    getCwd: () => '/tmp',
    getAppState: () => state,
    setAppState: (f) => { Object.assign(state, f(state)) },
    readFileState: { has: () => false, get: () => undefined, set: () => {} },
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    setMessages: () => {},
  }
}

describe('Command Types', () => {
  it('getCommandName returns name', () => {
    expect(getCommandName({ name: 'test', description: '' })).toBe('test')
  })

  it('getCommandName uses userFacingName override', () => {
    expect(getCommandName({ name: 'test', description: '', userFacingName: () => 'fancy' })).toBe('fancy')
  })

  it('isCommandEnabled defaults to true', () => {
    expect(isCommandEnabled({ name: 'test', description: '' })).toBe(true)
  })

  it('isCommandEnabled respects isEnabled', () => {
    expect(isCommandEnabled({ name: 'test', description: '', isEnabled: () => false })).toBe(false)
  })
})

describe('Command Registry', () => {
  it('getCommands returns built-in commands', () => {
    clearCommandsCache()
    const cmds = getCommands()
    expect(cmds.length).toBeGreaterThan(20)
  })

  it('all commands have name and description', () => {
    for (const cmd of getCommands()) {
      expect(cmd.name).toBeTruthy()
      expect(cmd.description).toBeTruthy()
    }
  })

  it('all commands have a valid type', () => {
    for (const cmd of getCommands()) {
      expect(['local', 'local-jsx', 'prompt']).toContain(cmd.type)
    }
  })

  it('includes essential commands', () => {
    const names = new Set(getCommands().map(c => c.name))
    expect(names.has('help')).toBe(true)
    expect(names.has('clear')).toBe(true)
    expect(names.has('exit')).toBe(true)
    expect(names.has('model')).toBe(true)
    expect(names.has('mode')).toBe(true)
    expect(names.has('cost')).toBe(true)
    expect(names.has('compact')).toBe(true)
    expect(names.has('config')).toBe(true)
    expect(names.has('memory')).toBe(true)
    expect(names.has('status')).toBe(true)
    expect(names.has('debug')).toBe(true)
    expect(names.has('verbose')).toBe(true)
    expect(names.has('doctor')).toBe(true)
    expect(names.has('diff')).toBe(true)
    expect(names.has('export')).toBe(true)
    expect(names.has('branch')).toBe(true)
    expect(names.has('theme')).toBe(true)
    expect(names.has('skills')).toBe(true)
    expect(names.has('permissions')).toBe(true)
    expect(names.has('plan')).toBe(true)
    expect(names.has('vim')).toBe(true)
    expect(names.has('mcp')).toBe(true)
    expect(names.has('session')).toBe(true)
    expect(names.has('resume')).toBe(true)
    expect(names.has('tasks')).toBe(true)
    expect(names.has('agents')).toBe(true)
    expect(names.has('review')).toBe(true)
    expect(names.has('feedback')).toBe(true)
    expect(names.has('keybindings')).toBe(true)
    expect(names.has('hooks')).toBe(true)
    expect(names.has('files')).toBe(true)
    expect(names.has('fast')).toBe(true)
    expect(names.has('copy')).toBe(true)
    expect(names.has('usage')).toBe(true)
  })
})

describe('findCommand', () => {
  it('finds by name', () => {
    expect(findCommand('help')).toBeDefined()
    expect(findCommand('help')!.name).toBe('help')
  })

  it('finds by alias', () => {
    const cmd = findCommand('quit')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('exit')
  })

  it('case-insensitive', () => {
    expect(findCommand('HELP')).toBeDefined()
    expect(findCommand('Help')).toBeDefined()
  })

  it('returns undefined for unknown', () => {
    expect(findCommand('nonexistent_cmd_xyz')).toBeUndefined()
  })
})

describe('getCommandNames', () => {
  it('returns /prefixed names', () => {
    const names = getCommandNames()
    expect(names.length).toBeGreaterThan(20)
    for (const name of names) {
      expect(name.startsWith('/')).toBe(true)
    }
  })
})

describe('builtInCommandNames', () => {
  it('returns set with names and aliases', () => {
    const names = builtInCommandNames()
    expect(names.has('help')).toBe(true)
    expect(names.has('h')).toBe(true) // alias
    expect(names.has('exit')).toBe(true)
    expect(names.has('quit')).toBe(true) // alias
    expect(names.has('q')).toBe(true) // alias
    expect(names.has('clear')).toBe(true)
    expect(names.has('reset')).toBe(true) // alias
    expect(names.has('new')).toBe(true) // alias
  })
})

describe('registerCommand', () => {
  it('adds a new command', () => {
    clearCommandsCache()
    const before = getCommands().length
    registerCommand({
      type: 'local',
      name: 'test-custom',
      description: 'A test command',
      supportsNonInteractive: true,
      async call() { return { type: 'text', value: 'custom result' } },
    })
    expect(getCommands().length).toBe(before + 1)
    expect(findCommand('test-custom')).toBeDefined()
  })

  it('replaces existing command with same name', () => {
    clearCommandsCache()
    const before = getCommands().length
    registerCommand({
      type: 'local',
      name: 'help',
      description: 'Custom help',
      supportsNonInteractive: true,
      async call() { return { type: 'text', value: 'custom help' } },
    })
    expect(getCommands().length).toBe(before) // Same count
    expect(findCommand('help')!.description).toBe('Custom help')
    clearCommandsCache() // Reset for other tests
  })
})

describe('executeCommand', () => {
  it('executes local commands', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('session', '', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('Session info')
  })

  it('executes model command with args', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('model', '', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('Current model')
  })

  it('executes doctor command', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('doctor', '', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('Kite Doctor')
    expect((result as any).value).toContain('Node.js')
  })

  it('executes compact command', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('compact', '', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('compact')
  })

  it('executes prompt commands', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('review', 'my code', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('review')
  })

  it('returns null for unknown commands', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('nonexistent_xyz', '', ctx)
    expect(result).toBeNull()
  })

  it('finds commands by alias', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('issue', 'bug report', ctx)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text')
    expect((result as any).value).toContain('Feedback')
  })

  it('executes keybindings command', async () => {
    const ctx = mockCommandContext()
    const result = await executeCommand('keybindings', '', ctx)
    expect(result).not.toBeNull()
    expect((result as any).value).toContain('Ctrl+C')
    expect((result as any).value).toContain('Escape')
  })

  it('executes debug toggle', async () => {
    const ctx = mockCommandContext()
    ctx.options.debug = false
    const result = await executeCommand('debug', '', ctx)
    expect(result).not.toBeNull()
    expect((result as any).value).toContain('enabled')
    expect(ctx.options.debug).toBe(true)
  })
})
