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

import { randomUUID } from 'crypto'
import type { MCPTransport } from './transport.js'
import type {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPClientInfo,
  MCPCapabilities,
  MCPInitializeResult,
  MCPToolDefinition,
  MCPToolCallRequest,
  MCPToolCallResult,
  MCPResource,
  MCPResourceReadResult,
  MCPPrompt,
  MCPPromptGetResult,
  MCPProgress,
} from './types.js'
import {
  MCP_CONNECTION_TIMEOUT_MS,
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  MCPSessionExpiredError,
  MCPToolCallError,
  MCPAuthError,
  isMCPSessionExpiredError,
  isTerminalConnectionError,
  MAX_ERRORS_BEFORE_RECONNECT,
} from './types.js'

// ============================================================================
// Pending request tracking
// ============================================================================

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  method: string
  timer?: ReturnType<typeof setTimeout>
}

// ============================================================================
// MCPClient
// ============================================================================

export class MCPClient {
  private transport: MCPTransport
  private pendingRequests = new Map<string | number, PendingRequest>()
  private nextId = 1
  private capabilities: MCPCapabilities = {}
  private serverInfo: { name: string; version: string } | null = null
  private instructions: string | undefined
  private _connected = false
  private consecutiveErrors = 0
  private notificationHandlers = new Map<string, (params: Record<string, unknown>) => void>()

  readonly name: string
  private clientInfo: MCPClientInfo

  onerror?: (error: Error) => void
  onclose?: () => void

  constructor(name: string, transport: MCPTransport, clientInfo?: MCPClientInfo) {
    this.name = name
    this.transport = transport
    this.clientInfo = clientInfo ?? { name: 'kite-code', version: '1.0.0' }

    // Wire transport events
    this.transport.onmessage = (msg) => this.handleMessage(msg)
    this.transport.onerror = (err) => this.handleTransportError(err)
    this.transport.onclose = () => this.handleTransportClose()
  }

  // ========================================================================
  // Connection lifecycle
  // ========================================================================

  get connected(): boolean { return this._connected }
  get serverCapabilities(): MCPCapabilities { return this.capabilities }
  get serverVersion(): { name: string; version: string } | null { return this.serverInfo }
  get serverInstructions(): string | undefined { return this.instructions }

  /**
   * Connect to the MCP server with timeout.
   */
  async connect(timeoutMs?: number): Promise<MCPInitializeResult> {
    const timeout = timeoutMs ?? MCP_CONNECTION_TIMEOUT_MS

    const connectPromise = this.doConnect()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`MCP server "${this.name}" connection timed out after ${timeout}ms`))
      }, timeout)
    })

    const result = await Promise.race([connectPromise, timeoutPromise])
    this._connected = true
    return result
  }

  private async doConnect(): Promise<MCPInitializeResult> {
    await this.transport.start()

    // Send initialize request
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { roots: {} },
      clientInfo: this.clientInfo,
    }) as MCPInitializeResult

    this.capabilities = result.capabilities
    this.serverInfo = result.serverInfo
    this.instructions = result.instructions

    // Send initialized notification
    await this.notify('notifications/initialized', {})

    return result
  }

  /**
   * Close the connection gracefully.
   */
  async close(): Promise<void> {
    this._connected = false
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'))
      if (pending.timer) clearTimeout(pending.timer)
    }
    this.pendingRequests.clear()
    await this.transport.close()
  }

  // ========================================================================
  // JSON-RPC request/response
  // ========================================================================

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  async request(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    const id = this.nextId++
    const timeout = timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject, method }

      if (timeout > 0 && timeout < Infinity) {
        pending.timer = setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request "${method}" timed out after ${timeout}ms`))
        }, timeout)
      }

      this.pendingRequests.set(id, pending)

      const message: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined && { params }),
      }

      this.transport.send(message).catch((err) => {
        this.pendingRequests.delete(id)
        if (pending.timer) clearTimeout(pending.timer)
        reject(err)
      })
    })
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.transport.send({
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    })
  }

  /**
   * Register a handler for incoming notifications.
   */
  setNotificationHandler(method: string, handler: (params: Record<string, unknown>) => void): void {
    this.notificationHandlers.set(method, handler)
  }

  // ========================================================================
  // MCP Protocol Operations
  // ========================================================================

  /**
   * List available tools from the server.
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    if (!this.capabilities.tools) return []
    const result = await this.request('tools/list') as { tools: MCPToolDefinition[] }
    return result.tools ?? []
  }

  /**
   * Call a tool on the server.
   */
  async callTool(
    request: MCPToolCallRequest,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<MCPToolCallResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS

    // Set up abort handling
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const resultPromise = this.request('tools/call', {
      name: request.name,
      arguments: request.arguments,
      ...(request._meta && { _meta: request._meta }),
    }, timeoutMs)

    // Race with abort signal
    if (options?.signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        options.signal!.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
      const result = await Promise.race([resultPromise, abortPromise])
      return result as MCPToolCallResult
    }

    return resultPromise as Promise<MCPToolCallResult>
  }

  /**
   * List available resources from the server.
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.capabilities.resources) return []
    const result = await this.request('resources/list') as { resources: MCPResource[] }
    return result.resources ?? []
  }

  /**
   * Read a resource from the server.
   */
  async readResource(uri: string): Promise<MCPResourceReadResult> {
    return this.request('resources/read', { uri }) as Promise<MCPResourceReadResult>
  }

  /**
   * List available prompts from the server.
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.capabilities.prompts) return []
    const result = await this.request('prompts/list') as { prompts: MCPPrompt[] }
    return result.prompts ?? []
  }

  /**
   * Get a prompt from the server.
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<MCPPromptGetResult> {
    return this.request('prompts/get', {
      name,
      ...(args && { arguments: args }),
    }) as Promise<MCPPromptGetResult>
  }

  // ========================================================================
  // Message handling
  // ========================================================================

  private handleMessage(message: JSONRPCMessage): void {
    // Response to a pending request
    if ('id' in message && message.id !== undefined) {
      const response = message as JSONRPCResponse
      const pending = this.pendingRequests.get(response.id)
      if (pending) {
        this.pendingRequests.delete(response.id)
        if (pending.timer) clearTimeout(pending.timer)

        if (response.error) {
          const err = new Error(response.error.message) as Error & { code?: number }
          err.code = response.error.code
          pending.reject(err)
        } else {
          this.consecutiveErrors = 0
          pending.resolve(response.result)
        }
      }
      return
    }

    // Notification
    if ('method' in message && !('id' in message)) {
      const handler = this.notificationHandlers.get(message.method)
      if (handler) {
        handler(message.params ?? {})
      }
    }
  }

  private handleTransportError(error: Error): void {
    if (isTerminalConnectionError(error.message)) {
      this.consecutiveErrors++
      if (this.consecutiveErrors >= MAX_ERRORS_BEFORE_RECONNECT) {
        this.consecutiveErrors = 0
        this._connected = false
      }
    } else {
      this.consecutiveErrors = 0
    }
    this.onerror?.(error)
  }

  private handleTransportClose(): void {
    this._connected = false
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport closed'))
      if (pending.timer) clearTimeout(pending.timer)
    }
    this.pendingRequests.clear()
    this.onclose?.()
  }
}
