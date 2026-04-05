/**
 * MCP transport implementations.
 *
 * Provides three transport types for communicating with MCP servers:
 * - StdioTransport: Spawns a child process, communicates via stdin/stdout (newline-delimited JSON)
 * - SSETransport: Server-Sent Events for receiving, HTTP POST for sending
 * - StreamableHTTPTransport: HTTP POST for both directions, with optional SSE streaming
 *
 * All HTTP transports use native Node.js fetch — no external HTTP libraries.
 */
import type { JSONRPCMessage, MCPStdioServerConfig, MCPSSEServerConfig, MCPHTTPServerConfig } from './types.js';
export interface MCPTransport {
    start(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
    close(): Promise<void>;
    onmessage?: (message: JSONRPCMessage) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
}
/**
 * Spawns a child process and communicates via stdin/stdout using newline-delimited JSON.
 *
 * Messages are serialized as JSON and separated by newline characters.
 * Partial messages are buffered until a complete line is received.
 * Stderr output is captured for diagnostics (capped at 64MB).
 */
export declare class StdioTransport implements MCPTransport {
    private config;
    private process;
    private buffer;
    private stderrBuffer;
    private readonly MAX_STDERR_SIZE;
    onmessage?: (message: JSONRPCMessage) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
    constructor(config: MCPStdioServerConfig);
    /**
     * Spawn the child process and set up stdin/stdout/stderr handlers.
     */
    start(): Promise<void>;
    /**
     * Send a JSON-RPC message to the child process via stdin.
     * Handles backpressure by waiting for the drain event if needed.
     */
    send(message: JSONRPCMessage): Promise<void>;
    /**
     * Gracefully shut down the child process.
     * Escalation: SIGINT (100ms) -> SIGTERM (400ms) -> SIGKILL
     */
    close(): Promise<void>;
    /**
     * The PID of the spawned child process, if running.
     */
    get pid(): number | undefined;
    /**
     * Captured stderr output from the child process.
     */
    get stderr(): string;
}
/**
 * SSE (Server-Sent Events) transport.
 *
 * Uses a manual SSE implementation with fetch() and ReadableStream parsing
 * since native EventSource doesn't support custom headers.
 *
 * The SSE connection receives two event types:
 * - `endpoint`: Provides the URL for sending messages via HTTP POST
 * - `message`: Delivers JSON-RPC messages from the server
 */
export declare class SSETransport implements MCPTransport {
    private config;
    private abortController;
    private endpoint;
    private headers;
    private connected;
    onmessage?: (message: JSONRPCMessage) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
    constructor(config: MCPSSEServerConfig);
    /**
     * Open an SSE connection to the server.
     * Parses the SSE stream manually using fetch() + ReadableStream.
     */
    start(): Promise<void>;
    /**
     * Parse the SSE stream from a ReadableStream<Uint8Array>.
     * Handles `event:` and `data:` fields per the SSE spec.
     */
    private readSSEStream;
    /**
     * Handle a parsed SSE event.
     */
    private handleSSEEvent;
    /**
     * Send a JSON-RPC message to the server via HTTP POST.
     */
    send(message: JSONRPCMessage): Promise<void>;
    /**
     * Close the SSE connection.
     */
    close(): Promise<void>;
}
/**
 * Streamable HTTP transport.
 *
 * Uses HTTP POST for both sending and receiving messages.
 * Responses may be returned as:
 * - application/json: A single JSON-RPC response
 * - text/event-stream: An SSE stream of JSON-RPC messages
 *
 * Session management is handled via the Mcp-Session-Id header.
 */
export declare class StreamableHTTPTransport implements MCPTransport {
    private config;
    private sessionId;
    private headers;
    private abortControllers;
    onmessage?: (message: JSONRPCMessage) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
    constructor(config: MCPHTTPServerConfig);
    /**
     * Initialize the transport. For StreamableHTTP, the connection is stateless
     * and doesn't require an explicit start. The session ID is acquired on the
     * first request/response exchange.
     */
    start(): Promise<void>;
    /**
     * Send a JSON-RPC message via HTTP POST.
     *
     * The response may be:
     * - application/json: Parsed as a JSON-RPC response and delivered via onmessage
     * - text/event-stream: Parsed as an SSE stream of JSON-RPC messages
     * - 202 Accepted (no body): For notifications that don't expect a response
     */
    send(message: JSONRPCMessage): Promise<void>;
    /**
     * Parse an SSE stream from a StreamableHTTP response.
     * Each SSE event contains a JSON-RPC message in its data field.
     */
    private readSSEResponse;
    /**
     * Handle a parsed SSE event from a StreamableHTTP response.
     */
    private handleSSEResponseEvent;
    /**
     * Close the transport and abort any in-flight requests.
     *
     * Sends a DELETE request to terminate the server session if a session ID exists.
     */
    close(): Promise<void>;
}
/**
 * Create the appropriate MCP transport based on the server configuration.
 *
 * Defaults to StdioTransport if no `type` is specified (for backwards compatibility
 * with configurations that only specify `command`).
 */
export declare function createTransport(config: MCPStdioServerConfig | MCPSSEServerConfig | MCPHTTPServerConfig): MCPTransport;
//# sourceMappingURL=transport.d.ts.map