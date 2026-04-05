/**
 * ListMcpResourcesTool — List resources from MCP servers.
 *
 * Lists available resources from MCP (Model Context Protocol) servers.
 * Currently returns a helpful message directing users to the /mcp command.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'

const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResources'

const inputSchema = z.strictObject({
  server_name: z.string().optional().describe(
    'Name of the MCP server to list resources from. If not provided, lists resources from all servers.'
  ),
})

type ListMcpResourcesInput = z.infer<typeof inputSchema>

interface ListMcpResourcesOutput {
  server_name?: string
  resources: string[]
  message: string
}

export const ListMcpResourcesTool = buildTool({
  name: LIST_MCP_RESOURCES_TOOL_NAME,
  searchHint: 'list MCP server resources model context protocol',
  maxResultSizeChars: 30_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description({ server_name }: ListMcpResourcesInput) {
    return server_name
      ? `List resources from MCP server "${server_name}"`
      : 'List resources from all MCP servers'
  },

  async prompt() {
    return `List available resources from MCP (Model Context Protocol) servers.

Input:
- server_name: (optional) Name of a specific MCP server to query. If omitted, lists resources from all connected servers.

Returns the list of resources available on the specified MCP server(s). Use this to discover what data sources and capabilities are available before using ReadMcpResource to access specific resources.

To manage MCP server connections, use the /mcp command.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'ListMcpResources'
  },

  toAutoClassifierInput(input: ListMcpResourcesInput) {
    return `list mcp resources ${input.server_name ?? 'all'}`
  },

  getToolUseSummary(input?: Partial<ListMcpResourcesInput>) {
    if (input?.server_name) return `List MCP resources from "${input.server_name}"`
    return 'List MCP resources'
  },

  getActivityDescription(input?: Partial<ListMcpResourcesInput>) {
    if (input?.server_name) return `Listing MCP resources from "${input.server_name}"`
    return 'Listing MCP resources'
  },

  async call(input: ListMcpResourcesInput) {
    const serverInfo = input.server_name
      ? `for server "${input.server_name}"`
      : 'from all servers'

    const message = [
      `MCP resource listing ${serverInfo} is not yet connected to a live MCP manager.`,
      '',
      'To manage MCP servers and their resources, use the /mcp command:',
      '  /mcp                   — Show MCP server status',
      '  /mcp add <server>      — Add a new MCP server',
      '  /mcp remove <server>   — Remove an MCP server',
      '',
      'Once MCP servers are connected, this tool will return their available resources.',
      'Resources can include files, database records, API responses, and other data',
      'exposed by the MCP server.',
    ].join('\n')

    return {
      data: {
        server_name: input.server_name,
        resources: [],
        message,
      } as ListMcpResourcesOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: ListMcpResourcesOutput, toolUseID: string) {
    if (content.resources.length > 0) {
      const resourceList = content.resources.map((r, i) => `${i + 1}. ${r}`).join('\n')
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: `MCP Resources:\n${resourceList}`,
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: content.message,
    }
  },
})

export { LIST_MCP_RESOURCES_TOOL_NAME }
