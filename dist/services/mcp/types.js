/**
 * MCP (Model Context Protocol) type definitions.
 *
 * Implements the same types as Claude Code's MCP system:
 * - JSON-RPC 2.0 message types
 * - MCP protocol schemas (tools, resources, prompts)
 * - Server configuration types (stdio, SSE, HTTP)
 * - Connection state types
 * - Tool/resource/prompt result types
 */
import { z } from 'zod';
/** Standard JSON-RPC error codes */
export const JSONRPC_ERROR = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    CONNECTION_CLOSED: -32000,
    SESSION_NOT_FOUND: -32001,
    URL_ELICITATION_REQUIRED: -32042,
};
// ============================================================================
// Zod Schemas for Configuration Validation
// ============================================================================
export const MCPStdioServerConfigSchema = z.object({
    type: z.literal('stdio').optional(),
    command: z.string().min(1, 'Command cannot be empty'),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
});
export const MCPSSEServerConfigSchema = z.object({
    type: z.literal('sse'),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
});
export const MCPHTTPServerConfigSchema = z.object({
    type: z.literal('http'),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
});
export const MCPServerConfigSchema = z.union([
    MCPStdioServerConfigSchema,
    MCPSSEServerConfigSchema,
    MCPHTTPServerConfigSchema,
]);
export const MCPConfigFileSchema = z.object({
    mcpServers: z.record(z.string(), MCPServerConfigSchema),
});
// ============================================================================
// Constants
// ============================================================================
export const DEFAULT_MCP_TOOL_TIMEOUT_MS = 100_000_000; // ~27.8 hours
export const MAX_MCP_DESCRIPTION_LENGTH = 2048;
export const MCP_REQUEST_TIMEOUT_MS = 60_000; // 60 seconds
export const MCP_CONNECTION_TIMEOUT_MS = 30_000; // 30 seconds
export const MCP_FETCH_CACHE_SIZE = 20;
export const MAX_ERRORS_BEFORE_RECONNECT = 3;
export const MCP_TOOL_NAME_PREFIX = 'mcp__';
// ============================================================================
// Error Classes
// ============================================================================
export class MCPAuthError extends Error {
    serverName;
    constructor(serverName, message) {
        super(message);
        this.name = 'MCPAuthError';
        this.serverName = serverName;
    }
}
export class MCPSessionExpiredError extends Error {
    constructor(serverName) {
        super(`MCP server "${serverName}" session expired`);
        this.name = 'MCPSessionExpiredError';
    }
}
export class MCPToolCallError extends Error {
    mcpMeta;
    constructor(message, mcpMeta) {
        super(message);
        this.name = 'MCPToolCallError';
        this.mcpMeta = mcpMeta;
    }
}
/**
 * Detect if an error indicates an expired MCP session.
 * HTTP 404 with JSON-RPC error code -32001 (session not found).
 */
export function isMCPSessionExpiredError(error) {
    const code = 'code' in error ? error.code : undefined;
    if (code !== 404)
        return false;
    return (error.message.includes('"code":-32001') ||
        error.message.includes('"code": -32001'));
}
// ============================================================================
// Helpers
// ============================================================================
/**
 * Normalize a server name for use in MCP tool names.
 * Replaces non-alphanumeric characters with underscores.
 */
export function normalizeNameForMCP(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
/**
 * Build a fully-qualified MCP tool name.
 */
export function buildMCPToolName(serverName, toolName) {
    return `${MCP_TOOL_NAME_PREFIX}${normalizeNameForMCP(serverName)}__${toolName}`;
}
/**
 * Parse an MCP tool name into server and tool parts.
 * Returns null if not a valid MCP tool name.
 */
export function parseMCPToolName(name) {
    if (!name.startsWith(MCP_TOOL_NAME_PREFIX))
        return null;
    const rest = name.slice(MCP_TOOL_NAME_PREFIX.length);
    const sepIndex = rest.indexOf('__');
    if (sepIndex === -1)
        return null;
    return {
        serverName: rest.slice(0, sepIndex),
        toolName: rest.slice(sepIndex + 2),
    };
}
/**
 * Check if an error is a terminal connection error.
 */
export function isTerminalConnectionError(message) {
    return (message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        message.includes('EPIPE') ||
        message.includes('EHOSTUNREACH') ||
        message.includes('ECONNREFUSED') ||
        message.includes('Body Timeout Error') ||
        message.includes('terminated') ||
        message.includes('SSE stream disconnected') ||
        message.includes('Failed to reconnect SSE stream'));
}
//# sourceMappingURL=types.js.map