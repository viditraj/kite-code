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

import { z } from 'zod'

// ============================================================================
// JSON-RPC 2.0 Types
// ============================================================================

export interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: JSONRPCError
}

export interface JSONRPCNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

export interface JSONRPCError {
  code: number
  message: string
  data?: unknown
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification

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
} as const

// ============================================================================
// MCP Protocol — Initialize
// ============================================================================

export interface MCPClientInfo {
  name: string
  version: string
}

export interface MCPServerInfo {
  name: string
  version: string
}

export interface MCPCapabilities {
  tools?: boolean | Record<string, unknown>
  resources?: boolean | Record<string, unknown>
  prompts?: boolean | Record<string, unknown>
  logging?: boolean | Record<string, unknown>
}

export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: MCPCapabilities
  serverInfo: MCPServerInfo
  instructions?: string
}

// ============================================================================
// MCP Protocol — Tools
// ============================================================================

export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    openWorldHint?: boolean
    title?: string
  }
  _meta?: Record<string, unknown>
}

export interface MCPToolCallRequest {
  name: string
  arguments: Record<string, unknown>
  _meta?: Record<string, unknown>
}

export interface MCPToolCallResult {
  content: MCPContentBlock[]
  isError?: boolean
  _meta?: Record<string, unknown>
  structuredContent?: Record<string, unknown>
}

export type MCPContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; text?: string; blob?: string; mimeType?: string } }

// ============================================================================
// MCP Protocol — Resources
// ============================================================================

export interface MCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  annotations?: { readOnlyHint?: boolean }
}

export interface MCPResourceReadResult {
  contents: Array<{
    uri: string
    text?: string
    blob?: string
    mimeType?: string
  }>
}

// ============================================================================
// MCP Protocol — Prompts
// ============================================================================

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant'
  content: MCPContentBlock | MCPContentBlock[]
}

export interface MCPPromptGetResult {
  description?: string
  messages: MCPPromptMessage[]
}

// ============================================================================
// MCP Protocol — Progress
// ============================================================================

export interface MCPProgress {
  type: 'mcp_progress'
  status: 'started' | 'progress' | 'completed' | 'failed'
  serverName: string
  toolName: string
  progress?: number
  total?: number
  progressMessage?: string
  elapsedTimeMs?: number
}

// ============================================================================
// Server Configuration Types
// ============================================================================

export interface MCPStdioServerConfig {
  type?: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPSSEServerConfig {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export interface MCPHTTPServerConfig {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type MCPServerConfig =
  | MCPStdioServerConfig
  | MCPSSEServerConfig
  | MCPHTTPServerConfig

export type ScopedMCPServerConfig = MCPServerConfig & {
  scope: 'user' | 'project' | 'local' | 'dynamic'
  disabled?: boolean
}

// ============================================================================
// Zod Schemas for Configuration Validation
// ============================================================================

export const MCPStdioServerConfigSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().min(1, 'Command cannot be empty'),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
})

export const MCPSSEServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const MCPHTTPServerConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const MCPServerConfigSchema = z.union([
  MCPStdioServerConfigSchema,
  MCPSSEServerConfigSchema,
  MCPHTTPServerConfigSchema,
])

export const MCPConfigFileSchema = z.object({
  mcpServers: z.record(z.string(), MCPServerConfigSchema),
})

// ============================================================================
// Connection State Types
// ============================================================================

export interface ConnectedMCPServer {
  name: string
  type: 'connected'
  capabilities: MCPCapabilities
  serverInfo?: MCPServerInfo
  instructions?: string
  config: ScopedMCPServerConfig
  cleanup: () => Promise<void>
}

export interface FailedMCPServer {
  name: string
  type: 'failed'
  config: ScopedMCPServerConfig
  error?: string
}

export interface PendingMCPServer {
  name: string
  type: 'pending'
  config: ScopedMCPServerConfig
}

export interface DisabledMCPServer {
  name: string
  type: 'disabled'
  config: ScopedMCPServerConfig
}

export type MCPServerConnection =
  | ConnectedMCPServer
  | FailedMCPServer
  | PendingMCPServer
  | DisabledMCPServer

// ============================================================================
// Server Resource (with server name attached)
// ============================================================================

export interface ServerResource extends MCPResource {
  server: string
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MCP_TOOL_TIMEOUT_MS = 100_000_000 // ~27.8 hours
export const MAX_MCP_DESCRIPTION_LENGTH = 2048
export const MCP_REQUEST_TIMEOUT_MS = 60_000 // 60 seconds
export const MCP_CONNECTION_TIMEOUT_MS = 30_000 // 30 seconds
export const MCP_FETCH_CACHE_SIZE = 20
export const MAX_ERRORS_BEFORE_RECONNECT = 3
export const MCP_TOOL_NAME_PREFIX = 'mcp__'

// ============================================================================
// Error Classes
// ============================================================================

export class MCPAuthError extends Error {
  serverName: string
  constructor(serverName: string, message: string) {
    super(message)
    this.name = 'MCPAuthError'
    this.serverName = serverName
  }
}

export class MCPSessionExpiredError extends Error {
  constructor(serverName: string) {
    super(`MCP server "${serverName}" session expired`)
    this.name = 'MCPSessionExpiredError'
  }
}

export class MCPToolCallError extends Error {
  mcpMeta?: { _meta?: Record<string, unknown> }
  constructor(message: string, mcpMeta?: { _meta?: Record<string, unknown> }) {
    super(message)
    this.name = 'MCPToolCallError'
    this.mcpMeta = mcpMeta
  }
}

/**
 * Detect if an error indicates an expired MCP session.
 * HTTP 404 with JSON-RPC error code -32001 (session not found).
 */
export function isMCPSessionExpiredError(error: Error): boolean {
  const code = 'code' in error ? (error as Error & { code?: number }).code : undefined
  if (code !== 404) return false
  return (
    error.message.includes('"code":-32001') ||
    error.message.includes('"code": -32001')
  )
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize a server name for use in MCP tool names.
 * Replaces non-alphanumeric characters with underscores.
 */
export function normalizeNameForMCP(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Build a fully-qualified MCP tool name.
 */
export function buildMCPToolName(serverName: string, toolName: string): string {
  return `${MCP_TOOL_NAME_PREFIX}${normalizeNameForMCP(serverName)}__${toolName}`
}

/**
 * Parse an MCP tool name into server and tool parts.
 * Returns null if not a valid MCP tool name.
 */
export function parseMCPToolName(name: string): { serverName: string; toolName: string } | null {
  if (!name.startsWith(MCP_TOOL_NAME_PREFIX)) return null
  const rest = name.slice(MCP_TOOL_NAME_PREFIX.length)
  const sepIndex = rest.indexOf('__')
  if (sepIndex === -1) return null
  return {
    serverName: rest.slice(0, sepIndex),
    toolName: rest.slice(sepIndex + 2),
  }
}

/**
 * Check if an error is a terminal connection error.
 */
export function isTerminalConnectionError(message: string): boolean {
  return (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EPIPE') ||
    message.includes('EHOSTUNREACH') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Body Timeout Error') ||
    message.includes('terminated') ||
    message.includes('SSE stream disconnected') ||
    message.includes('Failed to reconnect SSE stream')
  )
}
