import { describe, it, expect } from 'vitest'
import { buildTool, findToolByName, toolMatchesName } from './Tool.js'
import { z } from 'zod'

describe('buildTool', () => {
  it('applies fail-closed defaults', () => {
    const tool = buildTool({
      name: 'TestTool',
      maxResultSizeChars: 1000,
      inputSchema: z.strictObject({ x: z.string() }),
      async description() { return 'test' },
      async prompt() { return 'test prompt' },
      renderToolUseMessage() { return null },
      mapToolResultToToolResultBlockParam(data, id) {
        return { type: 'tool_result', tool_use_id: id, content: String(data) }
      },
      async call() { return { data: 'ok' } },
    })

    expect(tool.name).toBe('TestTool')
    expect(tool.isEnabled()).toBe(true)
    expect(tool.isConcurrencySafe({ x: 'test' })).toBe(false) // fail-closed
    expect(tool.isReadOnly({ x: 'test' })).toBe(false) // fail-closed
    expect(tool.userFacingName(undefined)).toBe('TestTool') // defaults to name
  })

  it('overrides defaults when provided', () => {
    const tool = buildTool({
      name: 'ReadTool',
      maxResultSizeChars: 1000,
      inputSchema: z.strictObject({}),
      async description() { return 'test' },
      async prompt() { return 'test' },
      mapToolResultToToolResultBlockParam(data, id) {
        return { type: 'tool_result', tool_use_id: id, content: '' }
      },
      async call() { return { data: null } },
      isConcurrencySafe() { return true },
      isReadOnly() { return true },
      userFacingName() { return 'CustomName' },
    })

    expect(tool.isConcurrencySafe({})).toBe(true)
    expect(tool.isReadOnly({})).toBe(true)
    expect(tool.userFacingName(undefined)).toBe('CustomName')
  })
})

describe('toolMatchesName', () => {
  it('matches primary name', () => {
    expect(toolMatchesName({ name: 'Bash' }, 'Bash')).toBe(true)
    expect(toolMatchesName({ name: 'Bash' }, 'FileRead')).toBe(false)
  })

  it('matches aliases', () => {
    expect(toolMatchesName({ name: 'Read', aliases: ['FileRead'] }, 'FileRead')).toBe(true)
    expect(toolMatchesName({ name: 'Read', aliases: ['FileRead'] }, 'Cat')).toBe(false)
  })
})

describe('findToolByName', () => {
  it('finds by name', () => {
    const tool = buildTool({
      name: 'TestTool',
      maxResultSizeChars: 100,
      inputSchema: z.strictObject({}),
      async description() { return '' },
      async prompt() { return '' },
      mapToolResultToToolResultBlockParam(d, id) { return { type: 'tool_result', tool_use_id: id, content: '' } },
      async call() { return { data: null } },
    })

    const found = findToolByName([tool], 'TestTool')
    expect(found).toBe(tool)

    const notFound = findToolByName([tool], 'Other')
    expect(notFound).toBeUndefined()
  })
})
