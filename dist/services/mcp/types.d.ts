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
export interface JSONRPCRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}
export interface JSONRPCResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: JSONRPCError;
}
export interface JSONRPCNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}
export interface JSONRPCError {
    code: number;
    message: string;
    data?: unknown;
}
export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;
/** Standard JSON-RPC error codes */
export declare const JSONRPC_ERROR: {
    readonly PARSE_ERROR: -32700;
    readonly INVALID_REQUEST: -32600;
    readonly METHOD_NOT_FOUND: -32601;
    readonly INVALID_PARAMS: -32602;
    readonly INTERNAL_ERROR: -32603;
    readonly CONNECTION_CLOSED: -32000;
    readonly SESSION_NOT_FOUND: -32001;
    readonly URL_ELICITATION_REQUIRED: -32042;
};
export interface MCPClientInfo {
    name: string;
    version: string;
}
export interface MCPServerInfo {
    name: string;
    version: string;
}
export interface MCPCapabilities {
    tools?: boolean | Record<string, unknown>;
    resources?: boolean | Record<string, unknown>;
    prompts?: boolean | Record<string, unknown>;
    logging?: boolean | Record<string, unknown>;
}
export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: MCPCapabilities;
    serverInfo: MCPServerInfo;
    instructions?: string;
}
export interface MCPToolDefinition {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        openWorldHint?: boolean;
        title?: string;
    };
    _meta?: Record<string, unknown>;
}
export interface MCPToolCallRequest {
    name: string;
    arguments: Record<string, unknown>;
    _meta?: Record<string, unknown>;
}
export interface MCPToolCallResult {
    content: MCPContentBlock[];
    isError?: boolean;
    _meta?: Record<string, unknown>;
    structuredContent?: Record<string, unknown>;
}
export type MCPContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    data: string;
    mimeType: string;
} | {
    type: 'resource';
    resource: {
        uri: string;
        text?: string;
        blob?: string;
        mimeType?: string;
    };
};
export interface MCPResource {
    uri: string;
    name?: string;
    description?: string;
    mimeType?: string;
    annotations?: {
        readOnlyHint?: boolean;
    };
}
export interface MCPResourceReadResult {
    contents: Array<{
        uri: string;
        text?: string;
        blob?: string;
        mimeType?: string;
    }>;
}
export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
export interface MCPPromptMessage {
    role: 'user' | 'assistant';
    content: MCPContentBlock | MCPContentBlock[];
}
export interface MCPPromptGetResult {
    description?: string;
    messages: MCPPromptMessage[];
}
export interface MCPProgress {
    type: 'mcp_progress';
    status: 'started' | 'progress' | 'completed' | 'failed';
    serverName: string;
    toolName: string;
    progress?: number;
    total?: number;
    progressMessage?: string;
    elapsedTimeMs?: number;
}
export interface MCPStdioServerConfig {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface MCPSSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
}
export interface MCPHTTPServerConfig {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
}
export type MCPServerConfig = MCPStdioServerConfig | MCPSSEServerConfig | MCPHTTPServerConfig;
export type ScopedMCPServerConfig = MCPServerConfig & {
    scope: 'user' | 'project' | 'local' | 'dynamic';
    disabled?: boolean;
};
export declare const MCPStdioServerConfigSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    command: string;
    args: string[];
    type?: "stdio" | undefined;
    env?: Record<string, string> | undefined;
}, {
    command: string;
    type?: "stdio" | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
}>;
export declare const MCPSSEServerConfigSchema: z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "sse";
    url: string;
    headers?: Record<string, string> | undefined;
}, {
    type: "sse";
    url: string;
    headers?: Record<string, string> | undefined;
}>;
export declare const MCPHTTPServerConfigSchema: z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "http";
    url: string;
    headers?: Record<string, string> | undefined;
}, {
    type: "http";
    url: string;
    headers?: Record<string, string> | undefined;
}>;
export declare const MCPServerConfigSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    command: string;
    args: string[];
    type?: "stdio" | undefined;
    env?: Record<string, string> | undefined;
}, {
    command: string;
    type?: "stdio" | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "sse";
    url: string;
    headers?: Record<string, string> | undefined;
}, {
    type: "sse";
    url: string;
    headers?: Record<string, string> | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "http";
    url: string;
    headers?: Record<string, string> | undefined;
}, {
    type: "http";
    url: string;
    headers?: Record<string, string> | undefined;
}>]>;
export declare const MCPConfigFileSchema: z.ZodObject<{
    mcpServers: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        command: string;
        args: string[];
        type?: "stdio" | undefined;
        env?: Record<string, string> | undefined;
    }, {
        command: string;
        type?: "stdio" | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "sse";
        url: string;
        headers?: Record<string, string> | undefined;
    }, {
        type: "sse";
        url: string;
        headers?: Record<string, string> | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "http";
        url: string;
        headers?: Record<string, string> | undefined;
    }, {
        type: "http";
        url: string;
        headers?: Record<string, string> | undefined;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    mcpServers: Record<string, {
        command: string;
        args: string[];
        type?: "stdio" | undefined;
        env?: Record<string, string> | undefined;
    } | {
        type: "sse";
        url: string;
        headers?: Record<string, string> | undefined;
    } | {
        type: "http";
        url: string;
        headers?: Record<string, string> | undefined;
    }>;
}, {
    mcpServers: Record<string, {
        command: string;
        type?: "stdio" | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
    } | {
        type: "sse";
        url: string;
        headers?: Record<string, string> | undefined;
    } | {
        type: "http";
        url: string;
        headers?: Record<string, string> | undefined;
    }>;
}>;
export interface ConnectedMCPServer {
    name: string;
    type: 'connected';
    capabilities: MCPCapabilities;
    serverInfo?: MCPServerInfo;
    instructions?: string;
    config: ScopedMCPServerConfig;
    cleanup: () => Promise<void>;
}
export interface FailedMCPServer {
    name: string;
    type: 'failed';
    config: ScopedMCPServerConfig;
    error?: string;
}
export interface PendingMCPServer {
    name: string;
    type: 'pending';
    config: ScopedMCPServerConfig;
}
export interface DisabledMCPServer {
    name: string;
    type: 'disabled';
    config: ScopedMCPServerConfig;
}
export type MCPServerConnection = ConnectedMCPServer | FailedMCPServer | PendingMCPServer | DisabledMCPServer;
export interface ServerResource extends MCPResource {
    server: string;
}
export declare const DEFAULT_MCP_TOOL_TIMEOUT_MS = 100000000;
export declare const MAX_MCP_DESCRIPTION_LENGTH = 2048;
export declare const MCP_REQUEST_TIMEOUT_MS = 60000;
export declare const MCP_CONNECTION_TIMEOUT_MS = 30000;
export declare const MCP_FETCH_CACHE_SIZE = 20;
export declare const MAX_ERRORS_BEFORE_RECONNECT = 3;
export declare const MCP_TOOL_NAME_PREFIX = "mcp__";
export declare class MCPAuthError extends Error {
    serverName: string;
    constructor(serverName: string, message: string);
}
export declare class MCPSessionExpiredError extends Error {
    constructor(serverName: string);
}
export declare class MCPToolCallError extends Error {
    mcpMeta?: {
        _meta?: Record<string, unknown>;
    };
    constructor(message: string, mcpMeta?: {
        _meta?: Record<string, unknown>;
    });
}
/**
 * Detect if an error indicates an expired MCP session.
 * HTTP 404 with JSON-RPC error code -32001 (session not found).
 */
export declare function isMCPSessionExpiredError(error: Error): boolean;
/**
 * Normalize a server name for use in MCP tool names.
 * Replaces non-alphanumeric characters with underscores.
 */
export declare function normalizeNameForMCP(name: string): string;
/**
 * Build a fully-qualified MCP tool name.
 */
export declare function buildMCPToolName(serverName: string, toolName: string): string;
/**
 * Parse an MCP tool name into server and tool parts.
 * Returns null if not a valid MCP tool name.
 */
export declare function parseMCPToolName(name: string): {
    serverName: string;
    toolName: string;
} | null;
/**
 * Check if an error is a terminal connection error.
 */
export declare function isTerminalConnectionError(message: string): boolean;
//# sourceMappingURL=types.d.ts.map