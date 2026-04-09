/**
 * MarketplaceTool — Agent-facing tools for the MCP Marketplace.
 *
 * Provides 4 tools:
 * - MarketplaceSearch: Search for MCP servers on mcpservers.org
 * - MarketplaceBrowse: Browse MCP servers by category
 * - MarketplaceInfo: Get detailed info about a specific server
 * - MarketplaceInstall: Install an MCP server from the marketplace
 *
 * These tools allow the LLM agent to discover and install MCP servers
 * from within a conversation — extending Kite's capabilities on demand.
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

// ============================================================================
// MarketplaceSearch tool
// ============================================================================

const MARKETPLACE_SEARCH_NAME = 'MarketplaceSearch'

const marketplaceSearchInputSchema = z.strictObject({
  query: z.string().describe('Search query to find MCP servers (e.g. "github", "database", "slack")'),
  category: z.string().optional().describe('Optional category filter: search, web-scraping, communication, productivity, development, database, cloud-service, file-system, cloud-storage, version-control, other'),
})

type MarketplaceSearchInput = z.infer<typeof marketplaceSearchInputSchema>

interface MarketplaceSearchOutput {
  servers: Array<{
    name: string
    description: string
    path: string
    isOfficial: boolean
  }>
  message: string
}

export const MarketplaceSearchTool = buildTool({
  name: MARKETPLACE_SEARCH_NAME,
  searchHint: 'search find mcp server marketplace mcpservers.org',
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  inputSchema: marketplaceSearchInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description(input: MarketplaceSearchInput) {
    return `Search MCP marketplace for "${input.query}"`
  },

  async prompt() {
    return `Search for MCP servers on mcpservers.org marketplace.

Use this tool when the user wants to find an MCP server for a specific purpose (e.g., "find a GitHub MCP server" or "search for database tools").

Input:
- query: Search keywords (e.g., "github", "postgres", "slack")
- category: (optional) Filter by category

Returns a list of matching servers with their names, descriptions, and install paths.
After finding a server, use MarketplaceInstall to install it.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'MarketplaceSearch' },

  getToolUseSummary(input?: Partial<MarketplaceSearchInput>) {
    if (!input?.query) return null
    return `Searching marketplace for "${input.query}"`
  },

  getActivityDescription(input?: Partial<MarketplaceSearchInput>) {
    if (!input?.query) return 'Searching MCP marketplace'
    return `Searching MCP marketplace for "${input.query}"`
  },

  async validateInput(input: MarketplaceSearchInput) {
    if (!input.query || !input.query.trim()) {
      return { result: false, message: 'Search query cannot be empty', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: MarketplaceSearchInput, _context: ToolUseContext) {
    const { searchServers } = await import('../../services/marketplace/client.js')

    try {
      const servers = await searchServers(input.query.trim(), {
        category: input.category as any,
        maxResults: 15,
      })

      return {
        data: {
          servers: servers.map(s => ({
            name: s.name,
            description: s.description,
            path: s.path,
            isOfficial: s.isOfficial,
          })),
          message: servers.length === 0
            ? `No servers found for "${input.query}". Try a different search term.`
            : `Found ${servers.length} server(s) matching "${input.query}".`,
        } as MarketplaceSearchOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          servers: [],
          message: `Search failed: ${message}`,
        } as MarketplaceSearchOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: MarketplaceSearchOutput, toolUseID: string) {
    const lines = [data.message]

    if (data.servers.length > 0) {
      lines.push('')
      for (const s of data.servers) {
        const badge = s.isOfficial ? ' (official)' : ''
        const id = s.path.replace(/^\/servers\//, '')
        lines.push(`- ${s.name}${badge}  [${id}]`)
        if (s.description) lines.push(`  ${s.description}`)
      }
      lines.push('')
      lines.push('Use MarketplaceInstall with the [id] to install, or MarketplaceInfo for details.')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
    }
  },
})

// ============================================================================
// MarketplaceBrowse tool
// ============================================================================

const MARKETPLACE_BROWSE_NAME = 'MarketplaceBrowse'

const marketplaceBrowseInputSchema = z.strictObject({
  category: z.string().optional().describe('Category to browse: search, web-scraping, communication, productivity, development, database, cloud-service, file-system, cloud-storage, version-control, other. Omit to see all.'),
  officialOnly: z.boolean().optional().describe('If true, only show official servers'),
})

type MarketplaceBrowseInput = z.infer<typeof marketplaceBrowseInputSchema>

interface MarketplaceBrowseOutput {
  servers: Array<{
    name: string
    description: string
    path: string
    isOfficial: boolean
  }>
  totalCount: number
  message: string
}

export const MarketplaceBrowseTool = buildTool({
  name: MARKETPLACE_BROWSE_NAME,
  searchHint: 'browse list mcp servers marketplace categories',
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  inputSchema: marketplaceBrowseInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description(input: MarketplaceBrowseInput) {
    return input.category
      ? `Browse MCP servers in category "${input.category}"`
      : 'Browse all MCP servers on marketplace'
  },

  async prompt() {
    return `Browse MCP servers available on mcpservers.org marketplace.

Use this tool to explore available MCP servers by category or view all servers.

Input:
- category: (optional) Filter by category
- officialOnly: (optional) Show only official servers

Available categories:
search, web-scraping, communication, productivity, development, database, cloud-service, file-system, cloud-storage, version-control, other

Returns a paginated list of servers.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'MarketplaceBrowse' },

  getToolUseSummary(input?: Partial<MarketplaceBrowseInput>) {
    if (input?.category) return `Browsing marketplace: ${input.category}`
    return 'Browsing MCP marketplace'
  },

  getActivityDescription(input?: Partial<MarketplaceBrowseInput>) {
    if (input?.category) return `Browsing marketplace: ${input.category}`
    return 'Browsing MCP marketplace'
  },

  async call(input: MarketplaceBrowseInput, _context: ToolUseContext) {
    const { browseServers } = await import('../../services/marketplace/client.js')

    try {
      const { servers, totalCount } = await browseServers({
        category: input.category as any,
        officialOnly: input.officialOnly,
        sort: 'name',
        page: 1,
      })

      return {
        data: {
          servers: servers.map(s => ({
            name: s.name,
            description: s.description,
            path: s.path,
            isOfficial: s.isOfficial,
          })),
          totalCount,
          message: servers.length === 0
            ? 'No servers found for the given filters.'
            : `Showing ${servers.length} of ${totalCount} total servers.`,
        } as MarketplaceBrowseOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          servers: [],
          totalCount: 0,
          message: `Browse failed: ${message}`,
        } as MarketplaceBrowseOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: MarketplaceBrowseOutput, toolUseID: string) {
    const lines = [data.message]

    if (data.servers.length > 0) {
      const shown = data.servers.slice(0, 15)
      lines.push('')
      for (const s of shown) {
        const badge = s.isOfficial ? ' (official)' : ''
        const id = s.path.replace(/^\/servers\//, '')
        lines.push(`- ${s.name}${badge}  [${id}]`)
        if (s.description) lines.push(`  ${s.description}`)
      }
      if (data.servers.length > 15) {
        lines.push(`... and ${data.totalCount - 15} more. Use MarketplaceSearch to narrow results.`)
      }
      lines.push('')
      lines.push('Use MarketplaceInstall with the [id] to install, or MarketplaceInfo for details.')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
    }
  },
})

// ============================================================================
// MarketplaceInfo tool
// ============================================================================

const MARKETPLACE_INFO_NAME = 'MarketplaceInfo'

const marketplaceInfoInputSchema = z.strictObject({
  serverPath: z.string().describe('Server path from marketplace (e.g. "microsoft/playwright-mcp" or "/servers/microsoft/playwright-mcp")'),
})

type MarketplaceInfoInput = z.infer<typeof marketplaceInfoInputSchema>

interface MarketplaceInfoOutput {
  name: string
  description: string
  githubUrl: string | null
  npmPackage: string | null
  hasInstallConfig: boolean
  installConfig: string | null
  longDescription: string
  message: string
}

export const MarketplaceInfoTool = buildTool({
  name: MARKETPLACE_INFO_NAME,
  searchHint: 'info details mcp server marketplace',
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  inputSchema: marketplaceInfoInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description(input: MarketplaceInfoInput) {
    return `Get details for MCP server "${input.serverPath}"`
  },

  async prompt() {
    return `Get detailed information about a specific MCP server from mcpservers.org.

Input:
- serverPath: The server's path (from MarketplaceSearch or MarketplaceBrowse results)

Returns the server's full description, GitHub URL, NPM package, and installation config.
Use MarketplaceInstall to install the server after reviewing its details.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'MarketplaceInfo' },

  getToolUseSummary(input?: Partial<MarketplaceInfoInput>) {
    if (!input?.serverPath) return null
    return `Getting info for "${input.serverPath}"`
  },

  getActivityDescription(input?: Partial<MarketplaceInfoInput>) {
    if (!input?.serverPath) return 'Fetching server details'
    return `Fetching details for "${input.serverPath}"`
  },

  async validateInput(input: MarketplaceInfoInput) {
    if (!input.serverPath || !input.serverPath.trim()) {
      return { result: false, message: 'Server path cannot be empty', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: MarketplaceInfoInput, _context: ToolUseContext) {
    const { getServerDetail } = await import('../../services/marketplace/client.js')

    try {
      const detail = await getServerDetail(input.serverPath.trim())

      return {
        data: {
          name: detail.name,
          description: detail.description,
          githubUrl: detail.githubUrl ?? null,
          npmPackage: detail.npmPackage ?? null,
          hasInstallConfig: !!detail.standardConfig,
          installConfig: detail.standardConfig
            ? JSON.stringify({ mcpServers: { [detail.standardConfig.serverName]: detail.standardConfig.config } }, null, 2)
            : null,
          longDescription: detail.longDescription.slice(0, 2000),
          message: `Details for "${detail.name}".`,
        } as MarketplaceInfoOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          name: input.serverPath,
          description: '',
          githubUrl: null,
          npmPackage: null,
          hasInstallConfig: false,
          installConfig: null,
          longDescription: '',
          message: `Failed to fetch details: ${message}`,
        } as MarketplaceInfoOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: MarketplaceInfoOutput, toolUseID: string) {
    const lines = [data.message, '']

    if (data.name) lines.push(`Name: ${data.name}`)
    if (data.description) lines.push(`Description: ${data.description}`)
    if (data.githubUrl) lines.push(`GitHub: ${data.githubUrl}`)
    if (data.npmPackage) lines.push(`NPM: ${data.npmPackage}`)

    if (data.installConfig) {
      lines.push('')
      lines.push('Install config:')
      lines.push(data.installConfig)
      lines.push('')
      lines.push('Use MarketplaceInstall to install this server.')
    } else {
      lines.push('')
      lines.push('No standard install config detected. Manual setup may be required.')
    }

    if (data.longDescription) {
      lines.push('')
      lines.push('---')
      lines.push(data.longDescription)
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
      is_error: data.message.startsWith('Failed'),
    }
  },
})

// ============================================================================
// MarketplaceInstall tool
// ============================================================================

const MARKETPLACE_INSTALL_NAME = 'MarketplaceInstall'

const marketplaceInstallInputSchema = z.strictObject({
  serverPath: z.string().describe('Server path from marketplace (e.g. "microsoft/playwright-mcp")'),
  scope: z.enum(['project', 'user']).optional().describe('Install scope: "project" writes to .mcp.json (default), "user" writes to ~/.kite/config.json'),
})

type MarketplaceInstallInput = z.infer<typeof marketplaceInstallInputSchema>

interface MarketplaceInstallOutput {
  success: boolean
  serverName: string
  configPath: string
  message: string
}

export const MarketplaceInstallTool = buildTool({
  name: MARKETPLACE_INSTALL_NAME,
  searchHint: 'install add mcp server marketplace',
  maxResultSizeChars: 10_000,
  shouldDefer: true,

  inputSchema: marketplaceInstallInputSchema,

  isReadOnly() { return false },
  isConcurrencySafe() { return false },

  async description(input: MarketplaceInstallInput) {
    return `Install MCP server from marketplace: "${input.serverPath}"`
  },

  async prompt() {
    return `Install an MCP server from the mcpservers.org marketplace.

Use this after finding a server via MarketplaceSearch or MarketplaceBrowse.

Input:
- serverPath: The server's path from search/browse results
- scope: (optional) "project" (default, writes to .mcp.json) or "user" (writes to ~/.kite/config.json)

The tool fetches the server's detail page, extracts the standard install config,
and writes it to the appropriate config file. The server will be available
after restarting Kite or reconnecting MCP servers.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return {
      behavior: 'passthrough' as const,
      message: `Install MCP server from marketplace: "${input.serverPath}"`,
    }
  },

  userFacingName() { return 'MarketplaceInstall' },

  getToolUseSummary(input?: Partial<MarketplaceInstallInput>) {
    if (!input?.serverPath) return null
    return `Installing "${input.serverPath}" from marketplace`
  },

  getActivityDescription(input?: Partial<MarketplaceInstallInput>) {
    if (!input?.serverPath) return 'Installing MCP server'
    return `Installing "${input.serverPath}" from marketplace`
  },

  async validateInput(input: MarketplaceInstallInput) {
    if (!input.serverPath || !input.serverPath.trim()) {
      return { result: false, message: 'Server path cannot be empty', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: MarketplaceInstallInput, context: ToolUseContext) {
    const { installFromMarketplace } = await import('../../services/marketplace/installer.js')

    const cwd = context.getCwd()
    const scope = input.scope ?? 'project'

    try {
      const result = await installFromMarketplace(input.serverPath.trim(), scope, cwd)

      return {
        data: {
          success: result.success,
          serverName: result.serverName,
          configPath: result.configPath,
          message: result.message,
        } as MarketplaceInstallOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          success: false,
          serverName: input.serverPath,
          configPath: '',
          message: `Install failed: ${message}`,
        } as MarketplaceInstallOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: MarketplaceInstallOutput, toolUseID: string) {
    const lines = [data.message]

    if (data.success) {
      lines.push('')
      lines.push(`Server: ${data.serverName}`)
      lines.push(`Config: ${data.configPath}`)
      lines.push('')
      lines.push('Restart Kite or reconnect MCP servers to use the new server.')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
      is_error: !data.success,
    }
  },
})
