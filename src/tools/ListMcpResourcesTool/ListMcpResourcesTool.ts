/**
 * ListMcpResourcesTool — List resources from MCP servers.
 *
 * Lists available resources from connected MCP servers. Each resource
 * includes its URI, name, description, and MIME type. Queries the live
 * MCPManager singleton for real server data.
 *
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
  resources: Array<{
    server: string
    uri: string
    name?: string
    description?: string
    mimeType?: string
  }>
  servers: Array<{
    name: string
    status: string
    toolCount: number
  }>
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

Returns the list of resources available on the specified MCP server(s), along with connection status for all servers. Use this to discover what data sources and capabilities are available before using ReadMcpResource to access specific resources.`
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
    const { getMCPManager } = await import('../../bootstrap/mcp.js')
    const manager = getMCPManager()

    if (!manager) {
      return {
        data: {
          server_name: input.server_name,
          resources: [],
          servers: [],
          message: 'No MCP servers are connected. MCP servers connect automatically when Kite starts. Check your .mcp.json or ~/.kite/config.json configuration.',
        } as ListMcpResourcesOutput,
      }
    }

    // Gather server connection status
    const connections = manager.getConnections()
    const servers: ListMcpResourcesOutput['servers'] = []
    for (const [name, conn] of connections) {
      const toolCount = (manager as any).toolCache?.get(name)?.length ?? 0
      servers.push({ name, status: conn.type, toolCount })
    }

    // Gather resources
    const allResources = manager.getAllResources()
    let filtered = allResources

    if (input.server_name) {
      filtered = allResources.filter(r => r.server === input.server_name)
      if (filtered.length === 0 && !connections.has(input.server_name)) {
        return {
          data: {
            server_name: input.server_name,
            resources: [],
            servers,
            message: `MCP server "${input.server_name}" is not connected. Connected servers: ${servers.map(s => s.name).join(', ') || 'none'}`,
          } as ListMcpResourcesOutput,
        }
      }
    }

    const resources = filtered.map(r => ({
      server: r.server,
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }))

    const serverSummary = servers
      .map(s => `${s.name} (${s.status}, ${s.toolCount} tools)`)
      .join(', ')

    const message = resources.length > 0
      ? `Found ${resources.length} resource(s). Connected servers: ${serverSummary}`
      : `No resources exposed by ${input.server_name ? `"${input.server_name}"` : 'connected servers'}. Connected servers: ${serverSummary}. Note: Many MCP servers provide tools but not resources.`

    return {
      data: {
        server_name: input.server_name,
        resources,
        servers,
        message,
      } as ListMcpResourcesOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: ListMcpResourcesOutput, toolUseID: string) {
    const lines = [content.message]

    if (content.servers.length > 0) {
      lines.push('')
      lines.push('Connected servers:')
      for (const s of content.servers) {
        lines.push(`  - ${s.name} [${s.status}] (${s.toolCount} tools)`)
      }
    }

    if (content.resources.length > 0) {
      lines.push('')
      lines.push('Resources:')
      for (const r of content.resources) {
        lines.push(`  ${r.server}://${r.uri}`)
        if (r.name) lines.push(`    Name: ${r.name}`)
        if (r.description) lines.push(`    ${r.description}`)
        if (r.mimeType) lines.push(`    Type: ${r.mimeType}`)
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
    }
  },
})

export { LIST_MCP_RESOURCES_TOOL_NAME }
