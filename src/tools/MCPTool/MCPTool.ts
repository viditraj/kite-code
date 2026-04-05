import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { Tool } from '../../Tool.js'
import type { ContentBlock } from '../../providers/types.js'

// ============================================================================
// Constants
// ============================================================================

export const MCP_TOOL_PREFIX = 'mcp__'

// ============================================================================
// Input Schema — MCP tools accept any input; schema is overridden at runtime
// ============================================================================

const inputSchema = z.object({}).passthrough()

// ============================================================================
// Output types
// ============================================================================

/** MCP tool output can be plain text or structured content blocks (including images). */
export type MCPToolOutput = string | ContentBlock[]

// ============================================================================
// MCPTool — generic MCP tool wrapper (matches Claude Code's MCPTool)
// ============================================================================

export const MCPTool = buildTool({
  name: 'mcp',
  maxResultSizeChars: 100_000,
  isMcp: true,
  inputSchema,

  async description() {
    return 'Execute an MCP tool.'
  },

  async prompt() {
    return 'Use this tool to interact with external MCP servers.'
  },

  checkPermissions: async () => ({
    behavior: 'passthrough' as const,
    message: 'MCPTool requires permission.',
  }),

  async call(): Promise<{ data: MCPToolOutput }> {
    // Stub — actual implementation is injected by MCP client at runtime.
    return { data: '' }
  },

  mapToolResultToToolResultBlockParam(content: MCPToolOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content,
    }
  },

  isConcurrencySafe: () => false,
  isReadOnly: () => false,
})

// ============================================================================
// createMCPTool — factory for creating MCP tool instances at runtime
// ============================================================================

export function createMCPTool(options: {
  serverName: string
  toolName: string
  description: string
  inputJsonSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<MCPToolOutput>
}): Tool {
  return buildTool({
    name: `${MCP_TOOL_PREFIX}${options.serverName}__${options.toolName}`,
    maxResultSizeChars: 100_000,
    isMcp: true,
    mcpInfo: { serverName: options.serverName, toolName: options.toolName },
    inputSchema: z.object({}).passthrough(),
    inputJSONSchema: options.inputJsonSchema as any,

    async description() {
      return options.description
    },

    async prompt() {
      return options.description
    },

    checkPermissions: async () => ({
      behavior: 'passthrough' as const,
      message: 'MCP tool requires permission.',
    }),

    async call(args) {
      const result = await options.execute(args)
      return { data: result }
    },

    mapToolResultToToolResultBlockParam(content: MCPToolOutput, toolUseID: string) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content,
      }
    },

    isConcurrencySafe: () => false,
    isReadOnly: () => false,
  })
}
