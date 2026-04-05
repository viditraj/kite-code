/**
 * MCP bootstrap — connect to all configured MCP servers and return merged tools.
 *
 * This module bridges the gap between MCP server discovery and the query engine.
 * It connects to all configured MCP servers (including the built-in Playwright
 * browser server), discovers their tools, and merges them with built-in tools
 * using assembleToolPool().
 *
 * Called from:
 *   - readlineRepl.ts (readline REPL startup)
 *   - REPL.tsx (Ink REPL startup)
 *   - cli.ts (print mode)
 */
import { MCPManager } from '../services/mcp/manager.js';
import type { Tools } from '../Tool.js';
/**
 * Connect to all MCP servers and return the merged tool pool.
 *
 * This function:
 * 1. Creates an MCPManager (singleton per session)
 * 2. Calls connectAll() to discover and connect all configured MCP servers
 * 3. Returns the merged tool pool (built-in + MCP tools)
 *
 * Connection errors are logged but don't block startup — the REPL will
 * still work with built-in tools if MCP servers fail to connect.
 */
export declare function bootstrapMCPTools(cwd?: string, options?: {
    /** Called for each server connection (success or failure) */
    onConnection?: (serverName: string, status: 'connected' | 'failed', toolCount: number) => void;
    /** Set of tool names to deny */
    denyList?: Set<string>;
}): Promise<{
    tools: Tools;
    mcpToolCount: number;
}>;
/**
 * Get the singleton MCPManager instance.
 * Returns null if bootstrapMCPTools hasn't been called yet.
 */
export declare function getMCPManager(): MCPManager | null;
/**
 * Disconnect all MCP servers and reset the manager.
 */
export declare function shutdownMCP(): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map