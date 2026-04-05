/**
 * MCP Server Manager — manages multiple MCP server connections.
 *
 * Implements the same patterns as Claude Code's MCP manager:
 * - Batch connection with concurrency limits (local: 3, remote: 20)
 * - Tool discovery and conversion to Kite Tool objects
 * - Resource and prompt fetching
 * - Connection caching with invalidation
 * - Graceful shutdown of all servers
 * - Reconnection on session expiry
 */
import type { Tool } from '../../Tool.js';
import type { MCPServerConnection, ScopedMCPServerConfig, MCPPrompt, ServerResource } from './types.js';
export interface MCPConnectionResult {
    connection: MCPServerConnection;
    tools: Tool[];
    resources: ServerResource[];
    prompts: MCPPrompt[];
}
export declare class MCPManager {
    private connections;
    private clients;
    private transports;
    private toolCache;
    private resourceCache;
    private promptCache;
    /**
     * Connect to all configured MCP servers.
     * Uses different concurrency for local (stdio) vs remote (SSE/HTTP) servers.
     */
    connectAll(cwd?: string, onConnection?: (result: MCPConnectionResult) => void): Promise<MCPConnectionResult[]>;
    /**
     * Connect to a batch of servers with a concurrency limit.
     */
    private connectBatch;
    /**
     * Connect to a single MCP server.
     */
    connectServer(name: string, config: ScopedMCPServerConfig): Promise<MCPConnectionResult>;
    private fetchTools;
    private convertTool;
    /**
     * Call a tool with session expiry retry.
     */
    private callToolWithRetry;
    /**
     * Format a tool call result for the LLM.
     *
     * When the result contains only text blocks, returns a plain string.
     * When it contains image blocks (e.g. screenshots from Playwright),
     * returns ContentBlock[] so the image data is passed through to the
     * model's vision capabilities.
     */
    private formatToolResult;
    private fetchResources;
    /**
     * Read a resource from a server.
     */
    readResource(serverName: string, uri: string): Promise<string>;
    private fetchPrompts;
    /**
     * Get a prompt from a server.
     */
    getPrompt(serverName: string, promptName: string, args?: Record<string, string>): Promise<string>;
    /**
     * Get all tools from all connected servers.
     */
    getAllTools(): Tool[];
    /**
     * Get all resources from all connected servers.
     */
    getAllResources(): ServerResource[];
    /**
     * Get all connections and their states.
     */
    getConnections(): Map<string, MCPServerConnection>;
    /**
     * Get a specific connection.
     */
    getConnection(name: string): MCPServerConnection | undefined;
    /**
     * Disconnect all servers gracefully.
     */
    disconnectAll(): Promise<void>;
    /**
     * Disconnect a single server.
     */
    disconnectServer(name: string): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map