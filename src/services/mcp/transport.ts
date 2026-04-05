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

import { spawn, type ChildProcess } from 'child_process'
import type {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPStdioServerConfig,
  MCPSSEServerConfig,
  MCPHTTPServerConfig,
} from './types.js'

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if a process with the given PID is still alive.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Transport Interface
// ============================================================================

export interface MCPTransport {
  start(): Promise<void>
  send(message: JSONRPCMessage): Promise<void>
  close(): Promise<void>
  onmessage?: (message: JSONRPCMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void
}

// ============================================================================
// StdioTransport
// ============================================================================

/**
 * Spawns a child process and communicates via stdin/stdout using newline-delimited JSON.
 *
 * Messages are serialized as JSON and separated by newline characters.
 * Partial messages are buffered until a complete line is received.
 * Stderr output is captured for diagnostics (capped at 64MB).
 */
export class StdioTransport implements MCPTransport {
  private process: ChildProcess | null = null
  private buffer = ''
  private stderrBuffer = ''
  private readonly MAX_STDERR_SIZE = 64 * 1024 * 1024 // 64MB cap

  onmessage?: (message: JSONRPCMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void

  constructor(private config: MCPStdioServerConfig) {}

  /**
   * Spawn the child process and set up stdin/stdout/stderr handlers.
   */
  async start(): Promise<void> {
    const child = spawn(this.config.command, this.config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    })

    this.process = child

    // Handle stdout: newline-delimited JSON messages
    child.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8')
      const lines = this.buffer.split('\n')
      // Keep the last (possibly incomplete) line in the buffer
      this.buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length === 0) continue
        try {
          const message = JSON.parse(trimmed) as JSONRPCMessage
          this.onmessage?.(message)
        } catch (err) {
          this.onerror?.(
            new Error(`Failed to parse JSON-RPC message from stdout: ${trimmed}`)
          )
        }
      }
    })

    // Handle stderr: capture for diagnostics
    child.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      if (this.stderrBuffer.length + text.length <= this.MAX_STDERR_SIZE) {
        this.stderrBuffer += text
      } else {
        // Cap at MAX_STDERR_SIZE, keeping the most recent data
        const remaining = this.MAX_STDERR_SIZE - this.stderrBuffer.length
        if (remaining > 0) {
          this.stderrBuffer += text.slice(0, remaining)
        }
      }
    })

    // Handle process errors
    child.on('error', (err: Error) => {
      this.onerror?.(new Error(`MCP stdio process error: ${err.message}`))
    })

    // Handle process exit
    child.on('exit', (code: number | null, signal: string | null) => {
      this.process = null
      if (code !== null && code !== 0) {
        this.onerror?.(
          new Error(
            `MCP stdio process exited with code ${code}${
              this.stderrBuffer ? `. stderr: ${this.stderrBuffer.slice(0, 2048)}` : ''
            }`
          )
        )
      } else if (signal) {
        this.onerror?.(
          new Error(`MCP stdio process killed by signal ${signal}`)
        )
      }
      this.onclose?.()
    })
  }

  /**
   * Send a JSON-RPC message to the child process via stdin.
   * Handles backpressure by waiting for the drain event if needed.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error('MCP stdio transport is not connected')
    }

    const data = JSON.stringify(message) + '\n'
    const canWrite = this.process.stdin.write(data)

    if (!canWrite) {
      // Handle backpressure: wait for the drain event
      await new Promise<void>((resolve, reject) => {
        const stdin = this.process!.stdin!

        const onDrain = () => {
          cleanup()
          resolve()
        }
        const onError = (err: Error) => {
          cleanup()
          reject(err)
        }
        const onClose = () => {
          cleanup()
          reject(new Error('stdin closed while waiting for drain'))
        }

        const cleanup = () => {
          stdin.removeListener('drain', onDrain)
          stdin.removeListener('error', onError)
          stdin.removeListener('close', onClose)
        }

        stdin.on('drain', onDrain)
        stdin.on('error', onError)
        stdin.on('close', onClose)
      })
    }
  }

  /**
   * Gracefully shut down the child process.
   * Escalation: SIGINT (100ms) -> SIGTERM (400ms) -> SIGKILL
   */
  async close(): Promise<void> {
    const child = this.process
    if (!child || child.pid === undefined) {
      this.process = null
      return
    }

    const pid = child.pid

    // Remove all listeners to prevent spurious callbacks during shutdown
    child.stdout?.removeAllListeners()
    child.stderr?.removeAllListeners()
    child.stdin?.removeAllListeners()

    // End stdin to signal the child that no more input is coming
    if (child.stdin && !child.stdin.destroyed) {
      child.stdin.end()
    }

    // Step 1: SIGINT
    if (isProcessAlive(pid)) {
      try {
        child.kill('SIGINT')
      } catch {
        // Process may have already exited
      }
      await sleep(100)
    }

    // Step 2: SIGTERM
    if (isProcessAlive(pid)) {
      try {
        child.kill('SIGTERM')
      } catch {
        // Process may have already exited
      }
      await sleep(400)
    }

    // Step 3: SIGKILL
    if (isProcessAlive(pid)) {
      try {
        child.kill('SIGKILL')
      } catch {
        // Process may have already exited
      }
    }

    // Wait for exit to complete (with a safety timeout)
    await new Promise<void>((resolve) => {
      if (!isProcessAlive(pid)) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        child.removeAllListeners('exit')
        resolve()
      }, 1000)

      child.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    child.removeAllListeners()
    this.process = null
  }

  /**
   * The PID of the spawned child process, if running.
   */
  get pid(): number | undefined {
    return this.process?.pid
  }

  /**
   * Captured stderr output from the child process.
   */
  get stderr(): string {
    return this.stderrBuffer
  }
}

// ============================================================================
// SSETransport
// ============================================================================

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
export class SSETransport implements MCPTransport {
  private abortController: AbortController | null = null
  private endpoint: string | null = null
  private headers: Record<string, string>
  private connected = false

  onmessage?: (message: JSONRPCMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void

  constructor(private config: MCPSSEServerConfig) {
    this.headers = config.headers ?? {}
  }

  /**
   * Open an SSE connection to the server.
   * Parses the SSE stream manually using fetch() + ReadableStream.
   */
  async start(): Promise<void> {
    this.abortController = new AbortController()
    const { signal } = this.abortController

    let response: Response
    try {
      response = await fetch(this.config.url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...this.headers,
        },
        signal,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (error.name !== 'AbortError') {
        this.onerror?.(new Error(`SSE connection failed: ${error.message}`))
      }
      return
    }

    if (!response.ok) {
      this.onerror?.(
        new Error(`SSE connection failed with status ${response.status}: ${response.statusText}`)
      )
      return
    }

    if (!response.body) {
      this.onerror?.(new Error('SSE response has no body'))
      return
    }

    this.connected = true

    // Read the SSE stream in the background
    this.readSSEStream(response.body, signal).catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return
      this.onerror?.(
        new Error(`SSE stream error: ${err instanceof Error ? err.message : String(err)}`)
      )
    })

    // Wait for the endpoint to be discovered (with timeout)
    const startTime = Date.now()
    const timeout = 30_000
    while (this.endpoint === null && Date.now() - startTime < timeout) {
      if (signal.aborted) return
      await sleep(50)
    }

    if (this.endpoint === null) {
      this.onerror?.(new Error('SSE transport: endpoint event not received within timeout'))
    }
  }

  /**
   * Parse the SSE stream from a ReadableStream<Uint8Array>.
   * Handles `event:` and `data:` fields per the SSE spec.
   */
  private async readSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let currentEvent = ''
    let currentData = ''

    try {
      while (true) {
        if (signal.aborted) break

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by blank lines
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''

        for (const line of parts) {
          if (line === '' || line === '\r') {
            // Blank line: dispatch the event
            if (currentData) {
              this.handleSSEEvent(currentEvent, currentData.trim())
            }
            currentEvent = ''
            currentData = ''
            continue
          }

          const stripped = line.endsWith('\r') ? line.slice(0, -1) : line

          if (stripped.startsWith('event:')) {
            currentEvent = stripped.slice(6).trim()
          } else if (stripped.startsWith('data:')) {
            const dataValue = stripped.slice(5)
            // Append data (with newline if multiple data lines)
            currentData += (currentData ? '\n' : '') + (dataValue.startsWith(' ') ? dataValue.slice(1) : dataValue)
          } else if (stripped.startsWith('id:')) {
            // SSE id field — ignored for now
          } else if (stripped.startsWith('retry:')) {
            // SSE retry field — ignored for now
          } else if (stripped.startsWith(':')) {
            // SSE comment — ignored
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      throw err
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // Ignore release errors
      }
      this.connected = false
      this.onclose?.()
    }
  }

  /**
   * Handle a parsed SSE event.
   */
  private handleSSEEvent(event: string, data: string): void {
    if (event === 'endpoint') {
      // The data is the URL we should POST messages to
      try {
        // Resolve relative URLs against the base URL
        const baseUrl = new URL(this.config.url)
        const endpointUrl = new URL(data, baseUrl)
        this.endpoint = endpointUrl.toString()
      } catch {
        // If URL parsing fails, try using data directly
        this.endpoint = data
      }
      return
    }

    if (event === 'message' || event === '') {
      // Parse the data as a JSON-RPC message
      try {
        const message = JSON.parse(data) as JSONRPCMessage
        this.onmessage?.(message)
      } catch (err) {
        this.onerror?.(
          new Error(`Failed to parse SSE message data as JSON: ${data.slice(0, 200)}`)
        )
      }
      return
    }

    // Unknown event types are silently ignored
  }

  /**
   * Send a JSON-RPC message to the server via HTTP POST.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.endpoint) {
      throw new Error('SSE transport: no endpoint URL available (not connected or endpoint not yet received)')
    }

    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(message),
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      throw new Error(`SSE transport POST failed: ${error.message}`)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `SSE transport POST failed with status ${response.status}: ${response.statusText}${
          body ? ` — ${body.slice(0, 500)}` : ''
        }`
      )
    }

    // Parse the response if it contains JSON-RPC data
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const responseBody = await response.json()
        if (responseBody && typeof responseBody === 'object' && 'jsonrpc' in responseBody) {
          this.onmessage?.(responseBody as JSONRPCMessage)
        }
      } catch {
        // Response may not be valid JSON-RPC — ignore
      }
    }
  }

  /**
   * Close the SSE connection.
   */
  async close(): Promise<void> {
    this.connected = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.endpoint = null
  }
}

// ============================================================================
// StreamableHTTPTransport
// ============================================================================

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
export class StreamableHTTPTransport implements MCPTransport {
  private sessionId: string | null = null
  private headers: Record<string, string>
  private abortControllers: Set<AbortController> = new Set()

  onmessage?: (message: JSONRPCMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void

  constructor(private config: MCPHTTPServerConfig) {
    this.headers = config.headers ?? {}
  }

  /**
   * Initialize the transport. For StreamableHTTP, the connection is stateless
   * and doesn't require an explicit start. The session ID is acquired on the
   * first request/response exchange.
   */
  async start(): Promise<void> {
    // StreamableHTTP is stateless — no persistent connection to open.
    // The session ID will be established during the first send() call
    // (typically the initialize request).
  }

  /**
   * Send a JSON-RPC message via HTTP POST.
   *
   * The response may be:
   * - application/json: Parsed as a JSON-RPC response and delivered via onmessage
   * - text/event-stream: Parsed as an SSE stream of JSON-RPC messages
   * - 202 Accepted (no body): For notifications that don't expect a response
   */
  async send(message: JSONRPCMessage): Promise<void> {
    const abortController = new AbortController()
    this.abortControllers.add(abortController)

    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...this.headers,
      }

      if (this.sessionId) {
        requestHeaders['Mcp-Session-Id'] = this.sessionId
      }

      let response: Response
      try {
        response = await fetch(this.config.url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(message),
          signal: abortController.signal,
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (error.name === 'AbortError') return
        throw new Error(`StreamableHTTP POST failed: ${error.message}`)
      }

      // Extract session ID from response headers
      const responseSessionId = response.headers.get('mcp-session-id')
      if (responseSessionId) {
        this.sessionId = responseSessionId
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        const error = new Error(
          `StreamableHTTP POST failed with status ${response.status}: ${response.statusText}${
            body ? ` — ${body.slice(0, 500)}` : ''
          }`
        )
        // Attach the status code for higher-level error classification
        ;(error as Error & { code?: number }).code = response.status
        throw error
      }

      // 202 Accepted: no response body expected (e.g., for notifications)
      if (response.status === 202) {
        return
      }

      const contentType = response.headers.get('content-type') ?? ''

      if (contentType.includes('text/event-stream')) {
        // Parse as SSE stream
        if (response.body) {
          await this.readSSEResponse(response.body, abortController.signal)
        }
      } else if (contentType.includes('application/json')) {
        // Parse as single JSON-RPC response
        try {
          const body = await response.json()
          if (Array.isArray(body)) {
            // Batch response
            for (const item of body) {
              if (item && typeof item === 'object' && 'jsonrpc' in item) {
                this.onmessage?.(item as JSONRPCMessage)
              }
            }
          } else if (body && typeof body === 'object' && 'jsonrpc' in body) {
            this.onmessage?.(body as JSONRPCMessage)
          }
        } catch (err) {
          this.onerror?.(
            new Error(
              `Failed to parse StreamableHTTP JSON response: ${
                err instanceof Error ? err.message : String(err)
              }`
            )
          )
        }
      }
      // Other content types are silently ignored
    } finally {
      this.abortControllers.delete(abortController)
    }
  }

  /**
   * Parse an SSE stream from a StreamableHTTP response.
   * Each SSE event contains a JSON-RPC message in its data field.
   */
  private async readSSEResponse(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let currentEvent = ''
    let currentData = ''

    try {
      while (true) {
        if (signal.aborted) break

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''

        for (const line of parts) {
          if (line === '' || line === '\r') {
            // Blank line: dispatch the event
            if (currentData) {
              this.handleSSEResponseEvent(currentEvent, currentData.trim())
            }
            currentEvent = ''
            currentData = ''
            continue
          }

          const stripped = line.endsWith('\r') ? line.slice(0, -1) : line

          if (stripped.startsWith('event:')) {
            currentEvent = stripped.slice(6).trim()
          } else if (stripped.startsWith('data:')) {
            const dataValue = stripped.slice(5)
            currentData +=
              (currentData ? '\n' : '') +
              (dataValue.startsWith(' ') ? dataValue.slice(1) : dataValue)
          } else if (stripped.startsWith(':')) {
            // SSE comment — ignored
          }
        }
      }

      // Process any remaining data after stream ends
      if (currentData) {
        this.handleSSEResponseEvent(currentEvent, currentData.trim())
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      throw err
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // Ignore release errors
      }
    }
  }

  /**
   * Handle a parsed SSE event from a StreamableHTTP response.
   */
  private handleSSEResponseEvent(event: string, data: string): void {
    // In StreamableHTTP, SSE events contain JSON-RPC messages
    if (event === 'message' || event === '') {
      try {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === 'object' && 'jsonrpc' in item) {
              this.onmessage?.(item as JSONRPCMessage)
            }
          }
        } else if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed) {
          this.onmessage?.(parsed as JSONRPCMessage)
        }
      } catch (err) {
        this.onerror?.(
          new Error(`Failed to parse StreamableHTTP SSE event data: ${data.slice(0, 200)}`)
        )
      }
    }
    // Other event types (e.g., 'error', custom) are silently ignored
  }

  /**
   * Close the transport and abort any in-flight requests.
   *
   * Sends a DELETE request to terminate the server session if a session ID exists.
   */
  async close(): Promise<void> {
    // Abort all in-flight requests
    for (const controller of this.abortControllers) {
      controller.abort()
    }
    this.abortControllers.clear()

    // Attempt to terminate the session on the server
    if (this.sessionId) {
      try {
        const requestHeaders: Record<string, string> = {
          'Mcp-Session-Id': this.sessionId,
          ...this.headers,
        }
        await fetch(this.config.url, {
          method: 'DELETE',
          headers: requestHeaders,
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        // Best-effort session termination — ignore errors
      }
      this.sessionId = null
    }

    this.onclose?.()
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create the appropriate MCP transport based on the server configuration.
 *
 * Defaults to StdioTransport if no `type` is specified (for backwards compatibility
 * with configurations that only specify `command`).
 */
export function createTransport(
  config: MCPStdioServerConfig | MCPSSEServerConfig | MCPHTTPServerConfig
): MCPTransport {
  const type = config.type

  if (type === 'sse') {
    return new SSETransport(config as MCPSSEServerConfig)
  }

  if (type === 'http') {
    return new StreamableHTTPTransport(config as MCPHTTPServerConfig)
  }

  // Default: stdio (type is undefined or 'stdio')
  return new StdioTransport(config as MCPStdioServerConfig)
}
