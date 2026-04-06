/**
 * McpAuthTool — OAuth authentication for MCP servers.
 *
 * Based on Claude Code's McpAuthTool.ts.
 * Creates a pseudo-tool for unauthenticated MCP servers that initiates
 * an OAuth flow. After successful auth, the server reconnects and
 * real tools replace this pseudo-tool.
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { Tool, ToolUseContext } from '../../Tool.js'

// ============================================================================
// Types
// ============================================================================

interface McpAuthConfig {
  type: string  // 'stdio' | 'sse' | 'http'
  url?: string
  command?: string
}

interface McpAuthOutput {
  status: 'auth_url' | 'auth_completed' | 'unsupported' | 'error'
  message: string
  authUrl?: string
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an MCP authentication pseudo-tool for a specific server.
 *
 * This tool surfaces when an MCP server is installed but not yet authenticated.
 * When invoked, it initiates an OAuth flow and returns the authorization URL.
 * After auth completes, the server reconnects and real tools replace this one.
 *
 * @param serverName - The MCP server name (e.g., 'github', 'slack')
 * @param config - The MCP server configuration
 * @param reconnectFn - Function to reconnect the server after auth
 * @param updateToolsFn - Function to update the tool pool after reconnection
 */
export function createMcpAuthTool(
  serverName: string,
  config: McpAuthConfig,
  reconnectFn?: (name: string) => Promise<{ tools: Tool[]; commands: unknown[]; resources: unknown[] }>,
  updateToolsFn?: (serverName: string, tools: Tool[]) => void,
): Tool {
  const toolName = `mcp__${serverName}__authenticate`

  return buildTool({
    name: toolName,
    searchHint: `authenticate with ${serverName} MCP server`,
    maxResultSizeChars: 5_000,
    strict: true,

    inputSchema: z.object({}),

    isReadOnly: () => true,
    isConcurrencySafe: () => true,

    async description() {
      return `Authenticate with ${serverName} MCP server`
    },

    async prompt() {
      return `The MCP server "${serverName}" requires OAuth authentication before its tools can be used. Call this tool to initiate the authentication flow. After authentication completes, the server's real tools will become available.`
    },

    async call(_input: Record<string, unknown>, context: ToolUseContext) {
      // Only SSE and HTTP transports support OAuth
      if (config.type === 'stdio') {
        return {
          data: {
            status: 'unsupported',
            message: `MCP server "${serverName}" uses stdio transport which does not support OAuth. Check the server configuration.`,
          } as McpAuthOutput,
        }
      }

      // For SSE/HTTP servers, attempt OAuth flow
      const authUrl = config.url
        ? `${config.url.replace(/\/+$/, '')}/oauth/authorize`
        : null

      if (!authUrl) {
        return {
          data: {
            status: 'error',
            message: `Cannot determine OAuth URL for "${serverName}". No URL configured.`,
          } as McpAuthOutput,
        }
      }

      // Attempt background reconnection if reconnect function provided
      if (reconnectFn) {
        void (async () => {
          try {
            const result = await reconnectFn(serverName)
            if (updateToolsFn && result.tools.length > 0) {
              updateToolsFn(serverName, result.tools)
            }
          } catch {
            // Non-fatal — user can retry via /mcp
          }
        })()
      }

      return {
        data: {
          status: 'auth_url',
          message: `To authenticate with "${serverName}", please visit the following URL in your browser:\n\n${authUrl}\n\nAfter authentication, the server will reconnect automatically and its tools will become available.`,
          authUrl,
        } as McpAuthOutput,
      }
    },

    mapToolResultToToolResultBlockParam(data: McpAuthOutput, toolUseID: string) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: data.message,
        is_error: data.status === 'error',
      }
    },
  })
}

export const MCP_AUTH_TOOL_PREFIX = 'mcp__'
export const MCP_AUTH_TOOL_SUFFIX = '__authenticate'
