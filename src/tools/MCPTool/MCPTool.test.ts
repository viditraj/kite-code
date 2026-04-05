import { describe, it, expect } from 'vitest'
import { createMCPTool, MCP_TOOL_PREFIX } from './MCPTool.js'
import type { MCPToolOutput } from './MCPTool.js'
import type { ContentBlock } from '../../providers/types.js'

describe('MCPTool', () => {
  describe('createMCPTool', () => {
    it('creates a tool with the correct MCP-prefixed name', () => {
      const tool = createMCPTool({
        serverName: 'playwright',
        toolName: 'browser_screenshot',
        description: 'Take a screenshot',
        inputJsonSchema: { type: 'object' },
        execute: async () => 'result',
      })

      expect(tool.name).toBe(`${MCP_TOOL_PREFIX}playwright__browser_screenshot`)
    })

    it('sets isMcp to true', () => {
      const tool = createMCPTool({
        serverName: 'test',
        toolName: 'test_tool',
        description: 'A test tool',
        inputJsonSchema: { type: 'object' },
        execute: async () => 'ok',
      })

      expect(tool.isMcp).toBe(true)
    })

    it('calls execute with args and returns text result', async () => {
      const tool = createMCPTool({
        serverName: 'test',
        toolName: 'echo',
        description: 'Echo tool',
        inputJsonSchema: { type: 'object' },
        execute: async (args) => `echo: ${args.message}`,
      })

      const result = await tool.call(
        { message: 'hello' },
        {} as any,
        async () => ({ behavior: 'allow' as const }),
        {},
      )

      expect(result.data).toBe('echo: hello')
    })

    it('handles image content blocks in execute result', async () => {
      const imageBlocks: ContentBlock[] = [
        { type: 'text', text: 'Screenshot taken' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ]

      const tool = createMCPTool({
        serverName: 'playwright',
        toolName: 'browser_screenshot',
        description: 'Take a screenshot',
        inputJsonSchema: { type: 'object' },
        execute: async () => imageBlocks,
      })

      const result = await tool.call(
        {},
        {} as any,
        async () => ({ behavior: 'allow' as const }),
        {},
      )

      // Result should be the content blocks array
      expect(Array.isArray(result.data)).toBe(true)
      const blocks = result.data as ContentBlock[]
      expect(blocks).toHaveLength(2)
      expect(blocks[0]!.type).toBe('text')
      expect(blocks[1]!.type).toBe('image')
    })

    it('mapToolResultToToolResultBlockParam handles string content', () => {
      const tool = createMCPTool({
        serverName: 'test',
        toolName: 'text_tool',
        description: 'Returns text',
        inputJsonSchema: { type: 'object' },
        execute: async () => 'plain text result',
      })

      const mapped = tool.mapToolResultToToolResultBlockParam('plain text result', 'tool-use-123')
      expect(mapped.type).toBe('tool_result')
      expect(mapped.tool_use_id).toBe('tool-use-123')
      expect(mapped.content).toBe('plain text result')
    })

    it('mapToolResultToToolResultBlockParam handles ContentBlock[] content', () => {
      const blocks: ContentBlock[] = [
        { type: 'text', text: 'Description' },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQ...' },
        },
      ]

      const tool = createMCPTool({
        serverName: 'playwright',
        toolName: 'screenshot',
        description: 'Screenshot',
        inputJsonSchema: { type: 'object' },
        execute: async () => blocks,
      })

      const mapped = tool.mapToolResultToToolResultBlockParam(blocks as any, 'tool-use-456')
      expect(mapped.type).toBe('tool_result')
      expect(mapped.tool_use_id).toBe('tool-use-456')
      // Content should be the array of blocks
      expect(Array.isArray(mapped.content)).toBe(true)
      const content = mapped.content as ContentBlock[]
      expect(content).toHaveLength(2)
      expect(content[1]!.type).toBe('image')
    })
  })
})
