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
import { MCP_CONNECTION_TIMEOUT_MS, DEFAULT_MCP_TOOL_TIMEOUT_MS, isTerminalConnectionError, MAX_ERRORS_BEFORE_RECONNECT, } from './types.js';
// ============================================================================
// MCPClient
// ============================================================================
export class MCPClient {
    transport;
    pendingRequests = new Map();
    nextId = 1;
    capabilities = {};
    serverInfo = null;
    instructions;
    _connected = false;
    consecutiveErrors = 0;
    notificationHandlers = new Map();
    name;
    clientInfo;
    onerror;
    onclose;
    constructor(name, transport, clientInfo) {
        this.name = name;
        this.transport = transport;
        this.clientInfo = clientInfo ?? { name: 'kite-code', version: '1.0.0' };
        // Wire transport events
        this.transport.onmessage = (msg) => this.handleMessage(msg);
        this.transport.onerror = (err) => this.handleTransportError(err);
        this.transport.onclose = () => this.handleTransportClose();
    }
    // ========================================================================
    // Connection lifecycle
    // ========================================================================
    get connected() { return this._connected; }
    get serverCapabilities() { return this.capabilities; }
    get serverVersion() { return this.serverInfo; }
    get serverInstructions() { return this.instructions; }
    /**
     * Connect to the MCP server with timeout.
     */
    async connect(timeoutMs) {
        const timeout = timeoutMs ?? MCP_CONNECTION_TIMEOUT_MS;
        const connectPromise = this.doConnect();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`MCP server "${this.name}" connection timed out after ${timeout}ms`));
            }, timeout);
        });
        const result = await Promise.race([connectPromise, timeoutPromise]);
        this._connected = true;
        return result;
    }
    async doConnect() {
        await this.transport.start();
        // Send initialize request
        const result = await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: { roots: {} },
            clientInfo: this.clientInfo,
        });
        this.capabilities = result.capabilities;
        this.serverInfo = result.serverInfo;
        this.instructions = result.instructions;
        // Send initialized notification
        await this.notify('notifications/initialized', {});
        return result;
    }
    /**
     * Close the connection gracefully.
     */
    async close() {
        this._connected = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Connection closed'));
            if (pending.timer)
                clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
        await this.transport.close();
    }
    // ========================================================================
    // JSON-RPC request/response
    // ========================================================================
    /**
     * Send a JSON-RPC request and wait for the response.
     */
    async request(method, params, timeoutMs) {
        const id = this.nextId++;
        const timeout = timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS;
        return new Promise((resolve, reject) => {
            const pending = { resolve, reject, method };
            if (timeout > 0 && timeout < Infinity) {
                pending.timer = setTimeout(() => {
                    this.pendingRequests.delete(id);
                    reject(new Error(`MCP request "${method}" timed out after ${timeout}ms`));
                }, timeout);
            }
            this.pendingRequests.set(id, pending);
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                ...(params !== undefined && { params }),
            };
            this.transport.send(message).catch((err) => {
                this.pendingRequests.delete(id);
                if (pending.timer)
                    clearTimeout(pending.timer);
                reject(err);
            });
        });
    }
    /**
     * Send a JSON-RPC notification (no response expected).
     */
    async notify(method, params) {
        await this.transport.send({
            jsonrpc: '2.0',
            method,
            ...(params !== undefined && { params }),
        });
    }
    /**
     * Register a handler for incoming notifications.
     */
    setNotificationHandler(method, handler) {
        this.notificationHandlers.set(method, handler);
    }
    // ========================================================================
    // MCP Protocol Operations
    // ========================================================================
    /**
     * List available tools from the server.
     */
    async listTools() {
        if (!this.capabilities.tools)
            return [];
        const result = await this.request('tools/list');
        return result.tools ?? [];
    }
    /**
     * Call a tool on the server.
     */
    async callTool(request, options) {
        const timeoutMs = options?.timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS;
        // Set up abort handling
        if (options?.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const resultPromise = this.request('tools/call', {
            name: request.name,
            arguments: request.arguments,
            ...(request._meta && { _meta: request._meta }),
        }, timeoutMs);
        // Race with abort signal
        if (options?.signal) {
            const abortPromise = new Promise((_, reject) => {
                options.signal.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            });
            const result = await Promise.race([resultPromise, abortPromise]);
            return result;
        }
        return resultPromise;
    }
    /**
     * List available resources from the server.
     */
    async listResources() {
        if (!this.capabilities.resources)
            return [];
        const result = await this.request('resources/list');
        return result.resources ?? [];
    }
    /**
     * Read a resource from the server.
     */
    async readResource(uri) {
        return this.request('resources/read', { uri });
    }
    /**
     * List available prompts from the server.
     */
    async listPrompts() {
        if (!this.capabilities.prompts)
            return [];
        const result = await this.request('prompts/list');
        return result.prompts ?? [];
    }
    /**
     * Get a prompt from the server.
     */
    async getPrompt(name, args) {
        return this.request('prompts/get', {
            name,
            ...(args && { arguments: args }),
        });
    }
    // ========================================================================
    // Message handling
    // ========================================================================
    handleMessage(message) {
        // Response to a pending request
        if ('id' in message && message.id !== undefined) {
            const response = message;
            const pending = this.pendingRequests.get(response.id);
            if (pending) {
                this.pendingRequests.delete(response.id);
                if (pending.timer)
                    clearTimeout(pending.timer);
                if (response.error) {
                    const err = new Error(response.error.message);
                    err.code = response.error.code;
                    pending.reject(err);
                }
                else {
                    this.consecutiveErrors = 0;
                    pending.resolve(response.result);
                }
            }
            return;
        }
        // Notification
        if ('method' in message && !('id' in message)) {
            const handler = this.notificationHandlers.get(message.method);
            if (handler) {
                handler(message.params ?? {});
            }
        }
    }
    handleTransportError(error) {
        if (isTerminalConnectionError(error.message)) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= MAX_ERRORS_BEFORE_RECONNECT) {
                this.consecutiveErrors = 0;
                this._connected = false;
            }
        }
        else {
            this.consecutiveErrors = 0;
        }
        this.onerror?.(error);
    }
    handleTransportClose() {
        this._connected = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Transport closed'));
            if (pending.timer)
                clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
        this.onclose?.();
    }
}
//# sourceMappingURL=client.js.map