/**
 * ReadMcpResourceTool — Read a specific resource from an MCP server.
 *
 * Reads a resource identified by server name and resource URI from a
 * connected MCP server. Queries the live MCPManager singleton.
 *
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'

const READ_MCP_RESOURCE_TOOL_NAME = 'ReadMcpResource'

const inputSchema = z.strictObject({
  server_name: z.string().describe('Name of the MCP server to read from (e.g., "linear", "github")'),
  resource_uri: z.string().describe('Resource URI to read (e.g., "file:///path/to/file", "linear://issue/123")'),
})

type ReadMcpResourceInput = z.infer<typeof inputSchema>

interface ReadMcpResourceOutput {
  server_name: string
  resource_uri: string
  content: string | null
  message: string
}

export const ReadMcpResourceTool = buildTool({
  name: READ_MCP_RESOURCE_TOOL_NAME,
  searchHint: 'read MCP server resource model context protocol',
  maxResultSizeChars: 100_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description({ server_name, resource_uri }: ReadMcpResourceInput) {
    return `Read resource "${resource_uri}" from MCP server "${server_name}"`
  },

  async prompt() {
    return `Read a specific resource from an MCP (Model Context Protocol) server.

Input:
- server_name: Name of the MCP server to read from (e.g., "linear", "github", "slack")
- resource_uri: URI identifying the resource to read (e.g., "file:///path", "linear://issue/123")

Returns the resource content as text or binary data. Resources can be files, database records, API responses, or any data exposed by the MCP server.

Use ListMcpResources first to discover available resources and connected servers.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'ReadMcpResource'
  },

  toAutoClassifierInput(input: ReadMcpResourceInput) {
    return `read mcp resource ${input.server_name} ${input.resource_uri}`
  },

  getToolUseSummary(input?: Partial<ReadMcpResourceInput>) {
    if (!input?.server_name || !input?.resource_uri) return null
    const uri = input.resource_uri.length > 60
      ? input.resource_uri.slice(0, 60) + '...'
      : input.resource_uri
    return `Read "${uri}" from ${input.server_name}`
  },

  getActivityDescription(input?: Partial<ReadMcpResourceInput>) {
    if (!input?.server_name) return 'Reading MCP resource'
    return `Reading resource from "${input.server_name}"`
  },

  async validateInput(input: ReadMcpResourceInput) {
    if (!input.server_name || !input.server_name.trim()) {
      return { result: false, message: 'server_name cannot be empty', errorCode: 1 }
    }
    if (!input.resource_uri || !input.resource_uri.trim()) {
      return { result: false, message: 'resource_uri cannot be empty', errorCode: 2 }
    }
    return { result: true }
  },

  async call(input: ReadMcpResourceInput) {
    const { getMCPManager } = await import('../../bootstrap/mcp.js')
    const manager = getMCPManager()

    if (!manager) {
      return {
        data: {
          server_name: input.server_name,
          resource_uri: input.resource_uri,
          content: null,
          message: 'No MCP servers are connected. MCP servers connect automatically when Kite starts.',
        } as ReadMcpResourceOutput,
      }
    }

    // Check if server is connected
    const connections = manager.getConnections()
    if (!connections.has(input.server_name)) {
      const available = Array.from(connections.keys())
      return {
        data: {
          server_name: input.server_name,
          resource_uri: input.resource_uri,
          content: null,
          message: `MCP server "${input.server_name}" is not connected. Available servers: ${available.join(', ') || 'none'}`,
        } as ReadMcpResourceOutput,
      }
    }

    try {
      const content = await manager.readResource(input.server_name, input.resource_uri)
      return {
        data: {
          server_name: input.server_name,
          resource_uri: input.resource_uri,
          content,
          message: `Read resource "${input.resource_uri}" from "${input.server_name}" (${content.length} chars)`,
        } as ReadMcpResourceOutput,
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        data: {
          server_name: input.server_name,
          resource_uri: input.resource_uri,
          content: null,
          message: `Failed to read resource "${input.resource_uri}" from "${input.server_name}": ${errMsg}`,
        } as ReadMcpResourceOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(content: ReadMcpResourceOutput, toolUseID: string) {
    if (content.content !== null) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: content.content,
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: content.message,
      is_error: true,
    }
  },
})

export { READ_MCP_RESOURCE_TOOL_NAME }
