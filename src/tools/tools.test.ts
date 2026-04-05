import { describe, it, expect } from 'vitest'
import { BashTool } from './BashTool/BashTool.js'
import { FileReadTool } from './FileReadTool/FileReadTool.js'
import { FileWriteTool } from './FileWriteTool/FileWriteTool.js'
import { FileEditTool } from './FileEditTool/FileEditTool.js'
import { GrepTool } from './GrepTool/GrepTool.js'
import { GlobTool } from './GlobTool/GlobTool.js'
import { WebFetchTool } from './WebFetchTool/WebFetchTool.js'
import { registerTools, getAllBaseTools, getTools, assembleToolPool, toolsToSchemas } from '../tools.js'

// Register all tools for tests
const ALL_TOOLS = [BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, WebFetchTool]
registerTools(ALL_TOOLS)

describe('Tool Registry', () => {
  it('getAllBaseTools returns all enabled tools', () => {
    const tools = getAllBaseTools()
    expect(tools.length).toBe(7)
    expect(tools.map(t => t.name).sort()).toEqual(
      ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'WebFetch', 'Write'].sort()
    )
  })

  it('getTools filters by deny list', () => {
    const tools = getTools(new Set(['Bash']))
    expect(tools.length).toBe(6)
    expect(tools.find(t => t.name === 'Bash')).toBeUndefined()
  })

  it('assembleToolPool sorts by name', () => {
    const pool = assembleToolPool()
    const names = pool.map(t => t.name)
    const sorted = [...names].sort()
    expect(names).toEqual(sorted)
  })

  it('toolsToSchemas produces valid schemas', () => {
    const schemas = toolsToSchemas(ALL_TOOLS)
    expect(schemas.length).toBe(7)
    for (const schema of schemas) {
      expect(schema.name).toBeTruthy()
      expect(schema.input_schema).toBeDefined()
      expect(schema.input_schema.type).toBe('object')
    }
  })
})

describe('BashTool', () => {
  it('has correct safety flags', () => {
    // read-only command
    expect(BashTool.isReadOnly({ command: 'ls -la' })).toBe(true)
    expect(BashTool.isConcurrencySafe({ command: 'ls -la' })).toBe(true)
    // write command
    expect(BashTool.isReadOnly({ command: 'rm -rf /tmp/test' })).toBe(false)
    expect(BashTool.isConcurrencySafe({ command: 'rm -rf /tmp/test' })).toBe(false)
  })

  it('executes commands', async () => {
    const ctx = { getCwd: () => '/tmp', abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await BashTool.call({ command: 'echo hello_kite_test' }, ctx as any)
    expect(result.data.stdout).toContain('hello_kite_test')
    expect(result.data.exitCode).toBe(0)
  })

  it('handles command errors', async () => {
    const ctx = { getCwd: () => '/tmp', abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await BashTool.call({ command: 'false' }, ctx as any)
    expect(result.data.exitCode).not.toBe(0)
  })

  it('maps results correctly', () => {
    const block = BashTool.mapToolResultToToolResultBlockParam(
      { stdout: 'hello', stderr: '', interrupted: false, exitCode: 0 },
      'test-id'
    )
    expect(block.tool_use_id).toBe('test-id')
    expect(block.content).toBe('hello')
    expect(block.is_error).toBe(false)
  })
})

describe('FileReadTool', () => {
  it('is read-only and concurrency-safe', () => {
    expect(FileReadTool.isReadOnly({ file_path: '/tmp/test' })).toBe(true)
    expect(FileReadTool.isConcurrencySafe({ file_path: '/tmp/test' })).toBe(true)
  })

  it('reads files', async () => {
    const ctx = { getCwd: () => process.cwd(), abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await FileReadTool.call({ file_path: 'package.json' }, ctx as any)
    expect(result.data.content).toContain('kite')
    expect(result.data.isDirectory).toBe(false)
  })
})

describe('FileEditTool', () => {
  it('validates old_string !== new_string', async () => {
    const ctx = { getCwd: () => '/tmp', abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await FileEditTool.validateInput!(
      { file_path: '/tmp/test', old_string: 'same', new_string: 'same' },
      ctx as any,
    )
    expect(result.result).toBe(false)
    expect(result.message).toContain('same')
  })
})

describe('GrepTool', () => {
  it('is read-only and concurrency-safe', () => {
    expect(GrepTool.isReadOnly({ pattern: 'test' })).toBe(true)
    expect(GrepTool.isConcurrencySafe({ pattern: 'test' })).toBe(true)
  })

  it('searches files', async () => {
    const ctx = { getCwd: () => process.cwd(), abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await GrepTool.call({ pattern: 'kite', path: 'package.json' }, ctx as any)
    expect(result.data.matchCount).toBeGreaterThan(0)
  })
})

describe('GlobTool', () => {
  it('is read-only and concurrency-safe', () => {
    expect(GlobTool.isReadOnly({ pattern: '*.ts' })).toBe(true)
    expect(GlobTool.isConcurrencySafe({ pattern: '*.ts' })).toBe(true)
  })

  it('finds files', async () => {
    const ctx = { getCwd: () => process.cwd(), abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await GlobTool.call({ pattern: '*.json' }, ctx as any)
    expect(result.data.files.length).toBeGreaterThan(0)
  })
})

describe('WebFetchTool', () => {
  it('is read-only, concurrency-safe, and deferred', () => {
    expect(WebFetchTool.isReadOnly({ url: 'https://example.com', prompt: '' })).toBe(true)
    expect(WebFetchTool.isConcurrencySafe({ url: 'https://example.com', prompt: '' })).toBe(true)
    expect(WebFetchTool.shouldDefer).toBe(true)
  })

  it('validates URLs', async () => {
    const ctx = { getCwd: () => '/tmp', abortController: new AbortController(), options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: '', isNonInteractiveSession: false }, messages: [] }
    const result = await WebFetchTool.validateInput!(
      { url: 'ftp://invalid', prompt: 'test' },
      ctx as any,
    )
    expect(result.result).toBe(false)
  })
})
