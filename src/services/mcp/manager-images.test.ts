import { describe, it, expect } from 'vitest'
import { MCPManager } from './manager.js'
import type { ContentBlock } from '../../providers/types.js'

describe('MCPManager image handling', () => {
  it('formatToolResult handles text-only results as string', () => {
    const manager = new MCPManager()
    // Access private method via any cast for testing
    const result = (manager as any).formatToolResult({
      content: [
        { type: 'text', text: 'Hello world' },
        { type: 'text', text: 'Second line' },
      ],
    })

    expect(typeof result).toBe('string')
    expect(result).toBe('Hello world\nSecond line')
  })

  it('formatToolResult handles empty content', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({ content: [] })
    expect(result).toBe('(No output)')
  })

  it('formatToolResult handles null content', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({ content: null })
    expect(result).toBe('(No output)')
  })

  it('formatToolResult returns ContentBlock[] when images present', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({
      content: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ],
    })

    expect(Array.isArray(result)).toBe(true)
    const blocks = result as ContentBlock[]
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'text', text: 'Screenshot captured' })
    expect(blocks[1]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'base64data' },
    })
  })

  it('formatToolResult defaults image mimeType to image/png', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({
      content: [
        { type: 'image', data: 'base64data', mimeType: '' },
      ],
    })

    expect(Array.isArray(result)).toBe(true)
    const blocks = result as ContentBlock[]
    expect(blocks[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'base64data' },
    })
  })

  it('formatToolResult handles resource blocks in mixed content', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({
      content: [
        { type: 'image', data: 'imgdata', mimeType: 'image/jpeg' },
        { type: 'resource', resource: { uri: 'file:///test.txt', text: 'file content' } },
      ],
    })

    expect(Array.isArray(result)).toBe(true)
    const blocks = result as ContentBlock[]
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.type).toBe('image')
    expect(blocks[1]).toEqual({ type: 'text', text: 'file content' })
  })

  it('formatToolResult handles resource blocks with blob in mixed content', () => {
    const manager = new MCPManager()
    const result = (manager as any).formatToolResult({
      content: [
        { type: 'image', data: 'imgdata', mimeType: 'image/jpeg' },
        { type: 'resource', resource: { uri: 'file:///data.bin', blob: 'blobdata', mimeType: 'application/octet-stream' } },
      ],
    })

    expect(Array.isArray(result)).toBe(true)
    const blocks = result as ContentBlock[]
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toEqual({ type: 'text', text: '[Resource: file:///data.bin, application/octet-stream]' })
  })
})
