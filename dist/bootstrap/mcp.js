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
import { assembleToolPool } from '../tools.js';
// Singleton MCPManager — shared across the session
let mcpManager = null;
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
export async function bootstrapMCPTools(cwd, options) {
    // Create manager (or reuse existing)
    if (!mcpManager) {
        mcpManager = new MCPManager();
    }
    try {
        const results = await mcpManager.connectAll(cwd, (result) => {
            const status = result.connection.type === 'connected' ? 'connected' : 'failed';
            options?.onConnection?.(result.connection.name, status, result.tools.length);
        });
        const mcpTools = mcpManager.getAllTools();
        const merged = assembleToolPool(options?.denyList, mcpTools);
        return { tools: merged, mcpToolCount: mcpTools.length };
    }
    catch (err) {
        // MCP failure should never block the REPL
        const message = err instanceof Error ? err.message : String(err);
        console.error(`MCP bootstrap error: ${message}`);
        // Return built-in tools only
        const builtInOnly = assembleToolPool(options?.denyList);
        return { tools: builtInOnly, mcpToolCount: 0 };
    }
}
/**
 * Get the singleton MCPManager instance.
 * Returns null if bootstrapMCPTools hasn't been called yet.
 */
export function getMCPManager() {
    return mcpManager;
}
/**
 * Disconnect all MCP servers and reset the manager.
 */
export async function shutdownMCP() {
    if (mcpManager) {
        await mcpManager.disconnectAll();
        mcpManager = null;
    }
}
//# sourceMappingURL=mcp.js.map