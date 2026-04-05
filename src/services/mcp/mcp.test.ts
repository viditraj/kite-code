import { describe, it, expect } from 'vitest'
import {
  normalizeNameForMCP,
  buildMCPToolName,
  parseMCPToolName,
  isTerminalConnectionError,
  isMCPSessionExpiredError,
  MCPAuthError,
  MCPSessionExpiredError,
  MCPToolCallError,
  MCP_TOOL_NAME_PREFIX,
  MCP_CONNECTION_TIMEOUT_MS,
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  MAX_MCP_DESCRIPTION_LENGTH,
} from './types.js'
import { getAllMCPConfigs, expandEnvVars, getMCPServerType, isLocalMCPServer, findProjectConfig } from './config.js'
import { MCPClient } from './client.js'
import { MCPManager } from './manager.js'
import type { MCPTransport } from './transport.js'
import type { JSONRPCMessage, JSONRPCResponse, MCPServerConfig } from './types.js'

// ============================================================================
// Types tests
// ============================================================================

describe('MCP Types', () => {
  describe('normalizeNameForMCP', () => {
    it('passes through simple names', () => {
      expect(normalizeNameForMCP('myserver')).toBe('myserver')
    })

    it('replaces special characters', () => {
      expect(normalizeNameForMCP('my server')).toBe('my_server')
      expect(normalizeNameForMCP('my.server')).toBe('my_server')
      expect(normalizeNameForMCP('my@server!')).toBe('my_server_')
    })

    it('preserves hyphens and underscores', () => {
      expect(normalizeNameForMCP('my-server_v2')).toBe('my-server_v2')
    })
  })

  describe('buildMCPToolName', () => {
    it('builds correct tool name', () => {
      expect(buildMCPToolName('github', 'list_repos')).toBe('mcp__github__list_repos')
    })

    it('normalizes server name', () => {
      expect(buildMCPToolName('my server', 'tool')).toBe('mcp__my_server__tool')
    })
  })

  describe('parseMCPToolName', () => {
    it('parses valid MCP tool name', () => {
      const result = parseMCPToolName('mcp__github__list_repos')
      expect(result).toEqual({ serverName: 'github', toolName: 'list_repos' })
    })

    it('returns null for non-MCP name', () => {
      expect(parseMCPToolName('FileRead')).toBeNull()
    })

    it('returns null for malformed name', () => {
      expect(parseMCPToolName('mcp__nope')).toBeNull()
    })
  })

  describe('isTerminalConnectionError', () => {
    it('detects ECONNRESET', () => {
      expect(isTerminalConnectionError('read ECONNRESET')).toBe(true)
    })
    it('detects ETIMEDOUT', () => {
      expect(isTerminalConnectionError('connect ETIMEDOUT')).toBe(true)
    })
    it('detects ECONNREFUSED', () => {
      expect(isTerminalConnectionError('connect ECONNREFUSED')).toBe(true)
    })
    it('passes normal errors', () => {
      expect(isTerminalConnectionError('some other error')).toBe(false)
    })
  })

  describe('Error classes', () => {
    it('MCPAuthError has serverName', () => {
      const err = new MCPAuthError('github', 'token expired')
      expect(err.serverName).toBe('github')
      expect(err.message).toBe('token expired')
      expect(err.name).toBe('MCPAuthError')
    })

    it('MCPSessionExpiredError has message', () => {
      const err = new MCPSessionExpiredError('github')
      expect(err.message).toContain('github')
      expect(err.name).toBe('MCPSessionExpiredError')
    })

    it('MCPToolCallError preserves mcpMeta', () => {
      const meta = { _meta: { key: 'value' } }
      const err = new MCPToolCallError('tool failed', meta)
      expect(err.mcpMeta).toBe(meta)
    })
  })

  describe('Constants', () => {
    it('MCP_TOOL_NAME_PREFIX is mcp__', () => {
      expect(MCP_TOOL_NAME_PREFIX).toBe('mcp__')
    })
    it('connection timeout is 30s', () => {
      expect(MCP_CONNECTION_TIMEOUT_MS).toBe(30_000)
    })
    it('default tool timeout is ~27.8 hours', () => {
      expect(DEFAULT_MCP_TOOL_TIMEOUT_MS).toBe(100_000_000)
    })
    it('max description length is 2048', () => {
      expect(MAX_MCP_DESCRIPTION_LENGTH).toBe(2048)
    })
  })
})

// ============================================================================
// Config tests
// ============================================================================

describe('MCP Config', () => {
  describe('expandEnvVars', () => {
    it('expands ${VAR} patterns', () => {
      process.env.TEST_MCP_VAR = 'hello'
      const result = expandEnvVars('value is ${TEST_MCP_VAR}')
      expect(result.expanded).toBe('value is hello')
      expect(result.missingVars).toEqual([])
      delete process.env.TEST_MCP_VAR
    })

    it('expands $VAR patterns', () => {
      process.env.TEST_MCP_VAR2 = 'world'
      const result = expandEnvVars('value is $TEST_MCP_VAR2')
      expect(result.expanded).toContain('world')
      delete process.env.TEST_MCP_VAR2
    })

    it('tracks missing variables', () => {
      delete process.env.NONEXISTENT_MCP_VAR
      const result = expandEnvVars('${NONEXISTENT_MCP_VAR}')
      expect(result.missingVars).toContain('NONEXISTENT_MCP_VAR')
    })

    it('supports defaults with ${VAR:-default}', () => {
      delete process.env.MISSING_WITH_DEFAULT
      const result = expandEnvVars('${MISSING_WITH_DEFAULT:-fallback}')
      expect(result.expanded).toBe('fallback')
      expect(result.missingVars).toEqual([])
    })

    it('returns original if no vars', () => {
      const result = expandEnvVars('no variables here')
      expect(result.expanded).toBe('no variables here')
    })
  })

  describe('getMCPServerType', () => {
    it('defaults to stdio', () => {
      expect(getMCPServerType({ command: 'node' })).toBe('stdio')
    })
    it('detects sse', () => {
      expect(getMCPServerType({ type: 'sse', url: 'http://...' } as MCPServerConfig)).toBe('sse')
    })
    it('detects http', () => {
      expect(getMCPServerType({ type: 'http', url: 'http://...' } as MCPServerConfig)).toBe('http')
    })
  })

  describe('isLocalMCPServer', () => {
    it('stdio is local', () => {
      expect(isLocalMCPServer({ command: 'node' })).toBe(true)
    })
    it('sse is not local', () => {
      expect(isLocalMCPServer({ type: 'sse', url: 'http://...' } as MCPServerConfig)).toBe(false)
    })
  })

  describe('getAllMCPConfigs', () => {
    it('returns empty for non-existent configs', () => {
      const { servers, errors } = getAllMCPConfigs('/nonexistent/path')
      // Should not throw, just return empty
      expect(typeof servers).toBe('object')
    })
  })
})

// ============================================================================
// Client tests (with mock transport)
// ============================================================================

function createMockTransport(): MCPTransport & { sentMessages: JSONRPCMessage[]; simulateResponse: (msg: JSONRPCMessage) => void } {
  const sentMessages: JSONRPCMessage[] = []
  let onmessage: ((msg: JSONRPCMessage) => void) | undefined

  return {
    sentMessages,
    async start() {},
    async send(msg: JSONRPCMessage) {
      sentMessages.push(msg)
      // Auto-respond to initialize
      if ('method' in msg && msg.method === 'initialize' && 'id' in msg) {
        queueMicrotask(() => {
          onmessage?.({
            jsonrpc: '2.0',
            id: msg.id!,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: true, resources: true, prompts: true },
              serverInfo: { name: 'mock', version: '1.0' },
              instructions: 'Test server',
            },
          })
        })
      }
    },
    async close() {},
    set onmessage(handler: ((msg: JSONRPCMessage) => void) | undefined) {
      onmessage = handler
    },
    get onmessage() { return onmessage },
    onerror: undefined,
    onclose: undefined,
    simulateResponse(msg: JSONRPCMessage) {
      onmessage?.(msg)
    },
  }
}

describe('MCPClient', () => {
  it('connects and initializes', async () => {
    const transport = createMockTransport()
    const client = new MCPClient('test', transport)

    const result = await client.connect(5000)
    expect(client.connected).toBe(true)
    expect(result.capabilities.tools).toBe(true)
    expect(result.serverInfo.name).toBe('mock')
    expect(result.instructions).toBe('Test server')
  })

  it('sends initialize and initialized', async () => {
    const transport = createMockTransport()
    const client = new MCPClient('test', transport)

    await client.connect(5000)

    // Should have sent initialize request and initialized notification
    const methods = transport.sentMessages.map(m => 'method' in m ? m.method : 'response')
    expect(methods).toContain('initialize')
    expect(methods).toContain('notifications/initialized')
  })

  it('tracks request/response by ID', async () => {
    const transport = createMockTransport()
    const client = new MCPClient('test', transport)
    await client.connect(5000)

    // Send a tools/list request
    const listPromise = client.listTools()

    // Find the sent request
    const toolsListMsg = transport.sentMessages.find(
      m => 'method' in m && m.method === 'tools/list',
    )
    expect(toolsListMsg).toBeDefined()

    // Simulate response
    transport.simulateResponse({
      jsonrpc: '2.0',
      id: (toolsListMsg as any).id,
      result: {
        tools: [
          { name: 'test_tool', description: 'A test tool', inputSchema: { type: 'object' } },
        ],
      },
    })

    const tools = await listPromise
    expect(tools).toHaveLength(1)
    expect(tools[0]!.name).toBe('test_tool')
  })

  it('closes and rejects pending requests', async () => {
    const transport = createMockTransport()
    const client = new MCPClient('test', transport)
    await client.connect(5000)

    // Start a request but don't respond
    const promise = client.listTools()

    // Close immediately
    await client.close()
    expect(client.connected).toBe(false)

    await expect(promise).rejects.toThrow('Connection closed')
  })

  it('handles notification handlers', async () => {
    const transport = createMockTransport()
    const client = new MCPClient('test', transport)
    await client.connect(5000)

    let notified = false
    client.setNotificationHandler('notifications/tools/list_changed', () => {
      notified = true
    })

    transport.simulateResponse({
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
      params: {},
    })

    // Give microtask a chance
    await new Promise(r => setTimeout(r, 10))
    expect(notified).toBe(true)
  })
})

// ============================================================================
// Manager tests
// ============================================================================

describe('MCPManager', () => {
  it('creates and disconnects cleanly', async () => {
    const manager = new MCPManager()
    await manager.disconnectAll()
    expect(manager.getAllTools()).toEqual([])
    expect(manager.getAllResources()).toEqual([])
  })

  it('getConnections returns empty map initially', () => {
    const manager = new MCPManager()
    expect(manager.getConnections().size).toBe(0)
  })

  it('getConnection returns undefined for unknown server', () => {
    const manager = new MCPManager()
    expect(manager.getConnection('nonexistent')).toBeUndefined()
  })
})
