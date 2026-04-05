/**
 * MCP Client — connects to a single MCP server and provides protocol operations.
 *
 * Implements the same patterns as Claude Code's MCP client:
 * - JSON-RPC 2.0 request/response with ID tracking
 * - Initialize handshake (capabilities negotiation)
 * - tools/list, tools/call
 * - resources/list, resources/read
 * - prompts/list, prompts/get
 * - Notification handlers (tools/list_changed, etc.)
 * - Connection timeout with Promise.race
 * - Error detection (session expired, auth errors)
 */
import type { MCPTransport } from './transport.js';
import type { MCPClientInfo, MCPCapabilities, MCPInitializeResult, MCPToolDefinition, MCPToolCallRequest, MCPToolCallResult, MCPResource, MCPResourceReadResult, MCPPrompt, MCPPromptGetResult } from './types.js';
export declare class MCPClient {
    private transport;
    private pendingRequests;
    private nextId;
    private capabilities;
    private serverInfo;
    private instructions;
    private _connected;
    private consecutiveErrors;
    private notificationHandlers;
    readonly name: string;
    private clientInfo;
    onerror?: (error: Error) => void;
    onclose?: () => void;
    constructor(name: string, transport: MCPTransport, clientInfo?: MCPClientInfo);
    get connected(): boolean;
    get serverCapabilities(): MCPCapabilities;
    get serverVersion(): {
        name: string;
        version: string;
    } | null;
    get serverInstructions(): string | undefined;
    /**
     * Connect to the MCP server with timeout.
     */
    connect(timeoutMs?: number): Promise<MCPInitializeResult>;
    private doConnect;
    /**
     * Close the connection gracefully.
     */
    close(): Promise<void>;
    /**
     * Send a JSON-RPC request and wait for the response.
     */
    request(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    /**
     * Send a JSON-RPC notification (no response expected).
     */
    notify(method: string, params?: Record<string, unknown>): Promise<void>;
    /**
     * Register a handler for incoming notifications.
     */
    setNotificationHandler(method: string, handler: (params: Record<string, unknown>) => void): void;
    /**
     * List available tools from the server.
     */
    listTools(): Promise<MCPToolDefinition[]>;
    /**
     * Call a tool on the server.
     */
    callTool(request: MCPToolCallRequest, options?: {
        signal?: AbortSignal;
        timeoutMs?: number;
    }): Promise<MCPToolCallResult>;
    /**
     * List available resources from the server.
     */
    listResources(): Promise<MCPResource[]>;
    /**
     * Read a resource from the server.
     */
    readResource(uri: string): Promise<MCPResourceReadResult>;
    /**
     * List available prompts from the server.
     */
    listPrompts(): Promise<MCPPrompt[]>;
    /**
     * Get a prompt from the server.
     */
    getPrompt(name: string, args?: Record<string, string>): Promise<MCPPromptGetResult>;
    private handleMessage;
    private handleTransportError;
    private handleTransportClose;
}
//# sourceMappingURL=client.d.ts.map