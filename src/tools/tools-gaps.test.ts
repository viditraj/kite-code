import { describe, it, expect } from 'vitest'
import { BashTool } from './BashTool/BashTool.js'
import { FileReadTool } from './FileReadTool/FileReadTool.js'
import { FileEditTool } from './FileEditTool/FileEditTool.js'
import { filterToolsByDenyRules, getMergedTools, registerTools, getAllBaseTools } from '../tools.js'
import { GrepTool } from './GrepTool/GrepTool.js'
import { GlobTool } from './GlobTool/GlobTool.js'
import { WebFetchTool } from './WebFetchTool/WebFetchTool.js'
import { FileWriteTool } from './FileWriteTool/FileWriteTool.js'

const ALL_TOOLS = [BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, WebFetchTool]

describe('BashTool.preparePermissionMatcher', () => {
  it('matches simple commands against patterns', async () => {
    const matcher = await BashTool.preparePermissionMatcher!({ command: 'git push origin main' })
    expect(matcher('git *')).toBe(true)
    expect(matcher('npm *')).toBe(false)
  })

  it('matches compound commands (&&)', async () => {
    const matcher = await BashTool.preparePermissionMatcher!({ command: 'ls && git push' })
    expect(matcher('git *')).toBe(true) // git push matches git *
    expect(matcher('ls')).toBe(true) // ls matches ls
    expect(matcher('rm *')).toBe(false)
  })

  it('matches prefix syntax (legacy :*)', async () => {
    const matcher = await BashTool.preparePermissionMatcher!({ command: 'npm install lodash' })
    expect(matcher('npm:*')).toBe(true)
    expect(matcher('yarn:*')).toBe(false)
  })

  it('matches exact commands', async () => {
    const matcher = await BashTool.preparePermissionMatcher!({ command: 'echo hello' })
    expect(matcher('echo hello')).toBe(true)
    expect(matcher('echo world')).toBe(false)
  })
})

describe('FileReadTool.backfillObservableInput', () => {
  it('expands tilde paths', () => {
    const input: Record<string, unknown> = { file_path: '~/test.txt' }
    FileReadTool.backfillObservableInput!(input)
    expect(input.file_path).not.toContain('~')
    expect(typeof input.file_path).toBe('string')
    expect((input.file_path as string).startsWith('/')).toBe(true)
  })

  it('resolves relative paths', () => {
    const input: Record<string, unknown> = { file_path: 'src/main.ts' }
    FileReadTool.backfillObservableInput!(input)
    expect((input.file_path as string).startsWith('/')).toBe(true)
  })

  it('leaves absolute paths unchanged', () => {
    const input: Record<string, unknown> = { file_path: '/usr/bin/node' }
    FileReadTool.backfillObservableInput!(input)
    expect(input.file_path).toBe('/usr/bin/node')
  })
})

describe('FileReadTool.preparePermissionMatcher', () => {
  it('matches exact paths', async () => {
    const matcher = await FileReadTool.preparePermissionMatcher!({ file_path: '/tmp/test.txt' })
    expect(matcher('/tmp/test.txt')).toBe(true)
    expect(matcher('/tmp/other.txt')).toBe(false)
  })

  it('matches wildcard patterns', async () => {
    const matcher = await FileReadTool.preparePermissionMatcher!({ file_path: '/home/user/project/src/main.ts' })
    expect(matcher('/home/user/project/*')).toBe(true)
  })
})

describe('FileEditTool.backfillObservableInput', () => {
  it('expands tilde paths', () => {
    const input: Record<string, unknown> = { file_path: '~/config.json' }
    FileEditTool.backfillObservableInput!(input)
    expect((input.file_path as string).startsWith('/')).toBe(true)
  })
})

describe('filterToolsByDenyRules', () => {
  it('filters by tool name', () => {
    const result = filterToolsByDenyRules(ALL_TOOLS, new Set(['Bash']))
    expect(result.find(t => t.name === 'Bash')).toBeUndefined()
    expect(result.length).toBe(6)
  })

  it('returns all when deny list is empty', () => {
    const result = filterToolsByDenyRules(ALL_TOOLS, new Set())
    expect(result.length).toBe(7)
  })
})

describe('getMergedTools', () => {
  it('returns built-in tools when no MCP tools', () => {
    registerTools(ALL_TOOLS)
    const result = getMergedTools()
    expect(result.length).toBe(7)
  })
})
