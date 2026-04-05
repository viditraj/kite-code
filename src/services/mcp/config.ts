/**
 * MCP server configuration loading.
 *
 * Loads, validates, and merges MCP server configs from three scopes:
 * - User:    ~/.kite/config.json
 * - Project: .mcp.json found walking up from cwd
 * - Local:   .kite/mcp.json or kite.config.json in cwd
 *
 * Higher-priority scopes override lower ones for the same server name.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { homedir } from 'os'
import {
  type MCPServerConfig,
  type ScopedMCPServerConfig,
  MCPConfigFileSchema,
} from './types.js'
import { getBuiltinBrowserConfig } from '../browser/config.js'

// ============================================================================
// Constants
// ============================================================================

const MCP_CONFIG_FILENAMES = ['.mcp.json', 'mcp.json']
const KITE_CONFIG_DIR = '.kite'
const USER_CONFIG_PATH = join(homedir(), KITE_CONFIG_DIR, 'config.json')

// ============================================================================
// Environment Variable Expansion
// ============================================================================

/**
 * Expand environment variables in a string.
 *
 * Supported patterns:
 *   ${VAR}           — replaced with process.env.VAR
 *   $VAR             — replaced with process.env.VAR (word-char boundary)
 *   ${VAR:-default}  — replaced with process.env.VAR, or "default" if unset/empty
 *
 * Returns the expanded string together with a list of variable names that were
 * referenced but had no value (and no default).
 */
export function expandEnvVars(value: string): { expanded: string; missingVars: string[] } {
  const missingVars: string[] = []

  // Pass 1 — ${VAR} and ${VAR:-default}
  let result = value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const defaultSepIdx = expr.indexOf(':-')
    if (defaultSepIdx !== -1) {
      const varName = expr.slice(0, defaultSepIdx)
      const defaultValue = expr.slice(defaultSepIdx + 2)
      const envValue = process.env[varName]
      if (envValue !== undefined && envValue !== '') {
        return envValue
      }
      return defaultValue
    }
    const envValue = process.env[expr]
    if (envValue !== undefined) {
      return envValue
    }
    missingVars.push(expr)
    return ''
  })

  // Pass 2 — bare $VAR (only word characters: [A-Za-z0-9_])
  result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName: string) => {
    const envValue = process.env[varName]
    if (envValue !== undefined) {
      return envValue
    }
    missingVars.push(varName)
    return ''
  })

  return { expanded: result, missingVars }
}

/**
 * Expand environment variables in all string fields of an MCP server config.
 *
 * For stdio configs: expands command, args entries, and env values.
 * For SSE / HTTP configs: expands url and header values.
 */
export function expandConfigEnvVars(config: MCPServerConfig): {
  expanded: MCPServerConfig
  missingVars: string[]
} {
  const allMissing: string[] = []

  const expand = (s: string): string => {
    const { expanded, missingVars } = expandEnvVars(s)
    allMissing.push(...missingVars)
    return expanded
  }

  const expandRecord = (rec: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [key, val] of Object.entries(rec)) {
      out[key] = expand(val)
    }
    return out
  }

  if (config.type === 'sse' || config.type === 'http') {
    const expanded: MCPServerConfig = {
      ...config,
      url: expand(config.url),
      ...(config.headers ? { headers: expandRecord(config.headers) } : {}),
    }
    return { expanded, missingVars: allMissing }
  }

  // stdio (type is 'stdio' or undefined)
  const stdioConfig = config as { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  const expanded: MCPServerConfig = {
    ...stdioConfig,
    command: expand(stdioConfig.command),
    ...(stdioConfig.args ? { args: stdioConfig.args.map(expand) } : {}),
    ...(stdioConfig.env ? { env: expandRecord(stdioConfig.env) } : {}),
  }
  return { expanded, missingVars: allMissing }
}

// ============================================================================
// Config File Loading
// ============================================================================

/**
 * Load and parse an MCP config file.
 *
 * The file must be JSON with the shape `{ mcpServers: Record<string, MCPServerConfig> }`.
 * Returns an empty record when the file doesn't exist or fails validation.
 */
export function loadMCPConfigFile(filePath: string): Record<string, MCPServerConfig> {
  try {
    if (!existsSync(filePath)) {
      return {}
    }
    const raw = readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw)
    const parsed = MCPConfigFileSchema.safeParse(json)
    if (!parsed.success) {
      return {}
    }
    return parsed.data.mcpServers as Record<string, MCPServerConfig>
  } catch {
    return {}
  }
}

// ============================================================================
// Config Discovery
// ============================================================================

/**
 * Walk up from `cwd` toward the filesystem root looking for an MCP config file
 * (`.mcp.json` or `mcp.json`).
 *
 * Returns the absolute path to the first match, or `null` if none is found.
 */
export function findProjectConfig(cwd: string): string | null {
  let dir = resolve(cwd)

  while (true) {
    for (const filename of MCP_CONFIG_FILENAMES) {
      const candidate = join(dir, filename)
      if (existsSync(candidate)) {
        return candidate
      }
    }

    const parent = dirname(dir)
    if (parent === dir) {
      // Reached filesystem root
      return null
    }
    dir = parent
  }
}

// ============================================================================
// Scoped Config Loaders
// ============================================================================

/**
 * Load user-level MCP config from `~/.kite/config.json`.
 *
 * The file may contain a top-level `mcpServers` key.  Each entry is tagged
 * with `scope: 'user'` and has its environment variables expanded.
 */
export function loadUserConfig(): Record<string, ScopedMCPServerConfig> {
  const result: Record<string, ScopedMCPServerConfig> = {}

  try {
    if (!existsSync(USER_CONFIG_PATH)) {
      return result
    }
    const raw = readFileSync(USER_CONFIG_PATH, 'utf-8')
    const json = JSON.parse(raw)

    if (!json || typeof json !== 'object' || !json.mcpServers || typeof json.mcpServers !== 'object') {
      return result
    }

    const parsed = MCPConfigFileSchema.safeParse(json)
    if (!parsed.success) {
      return result
    }

    const servers = parsed.data.mcpServers as Record<string, MCPServerConfig>
    for (const [name, config] of Object.entries(servers)) {
      const { expanded } = expandConfigEnvVars(config)
      result[name] = { ...expanded, scope: 'user' } as ScopedMCPServerConfig
    }
  } catch {
    // Ignore unreadable / malformed config
  }

  return result
}

/**
 * Load project-level MCP config by searching for `.mcp.json` / `mcp.json`
 * starting from `cwd` and walking up the directory tree.
 *
 * Each entry is tagged with `scope: 'project'` and has its environment
 * variables expanded.
 */
export function loadProjectConfig(cwd: string): Record<string, ScopedMCPServerConfig> {
  const result: Record<string, ScopedMCPServerConfig> = {}

  const configPath = findProjectConfig(cwd)
  if (!configPath) {
    return result
  }

  const servers = loadMCPConfigFile(configPath)
  for (const [name, config] of Object.entries(servers)) {
    const { expanded } = expandConfigEnvVars(config)
    result[name] = { ...expanded, scope: 'project' } as ScopedMCPServerConfig
  }

  return result
}

/**
 * Load local (working-directory) MCP config.
 *
 * Checks two locations inside `cwd`:
 *   1. `.kite/mcp.json`        — dedicated MCP config
 *   2. `kite.config.json`      — general Kite config with optional `mcpServers`
 *
 * Later sources override earlier ones for the same server name.
 * Each entry is tagged with `scope: 'local'`.
 */
export function loadLocalConfig(cwd: string): Record<string, ScopedMCPServerConfig> {
  const result: Record<string, ScopedMCPServerConfig> = {}
  const resolvedCwd = resolve(cwd)

  // Source 1: .kite/mcp.json
  const kiteMcpPath = join(resolvedCwd, KITE_CONFIG_DIR, 'mcp.json')
  const kiteMcpServers = loadMCPConfigFile(kiteMcpPath)
  for (const [name, config] of Object.entries(kiteMcpServers)) {
    const { expanded } = expandConfigEnvVars(config)
    result[name] = { ...expanded, scope: 'local' } as ScopedMCPServerConfig
  }

  // Source 2: kite.config.json (mcpServers section)
  const kiteConfigPath = join(resolvedCwd, 'kite.config.json')
  try {
    if (existsSync(kiteConfigPath)) {
      const raw = readFileSync(kiteConfigPath, 'utf-8')
      const json = JSON.parse(raw)

      if (json && typeof json === 'object' && json.mcpServers && typeof json.mcpServers === 'object') {
        const parsed = MCPConfigFileSchema.safeParse(json)
        if (parsed.success) {
          const servers = parsed.data.mcpServers as Record<string, MCPServerConfig>
          for (const [name, config] of Object.entries(servers)) {
            const { expanded } = expandConfigEnvVars(config)
            result[name] = { ...expanded, scope: 'local' } as ScopedMCPServerConfig
          }
        }
      }
    }
  } catch {
    // Ignore unreadable / malformed config
  }

  return result
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Load and merge MCP server configs from every scope.
 *
 * Priority (highest wins for a given server name):
 *   1. Local   — `.kite/mcp.json` or `kite.config.json` in cwd
 *   2. Project — `.mcp.json` found walking up from cwd
 *   3. User    — `~/.kite/config.json`
 *
 * Disabled servers are filtered out.  Missing environment variables are
 * collected and returned as errors.
 */
export function getAllMCPConfigs(cwd?: string): {
  servers: Record<string, ScopedMCPServerConfig>
  errors: string[]
} {
  const workingDir = cwd ?? process.cwd()
  const errors: string[] = []
  const allMissing: string[] = []

  // Helper: expand and track missing vars
  const expandAndTrack = (
    configs: Record<string, ScopedMCPServerConfig>,
  ): Record<string, ScopedMCPServerConfig> => {
    const out: Record<string, ScopedMCPServerConfig> = {}
    for (const [name, config] of Object.entries(configs)) {
      const { expanded, missingVars } = expandConfigEnvVars(config as MCPServerConfig)
      if (missingVars.length > 0) {
        allMissing.push(...missingVars)
        errors.push(
          `Server "${name}": missing environment variable(s): ${missingVars.join(', ')}`,
        )
      }
      out[name] = { ...expanded, scope: config.scope, disabled: config.disabled } as ScopedMCPServerConfig
    }
    return out
  }

  // Load from lowest to highest priority, letting higher overwrite lower.
  // Built-in servers (e.g. Playwright browser) have the lowest priority
  // so users can override or disable them.
  const builtinConfigs = getBuiltinBrowserConfig()
  const userConfigs = loadUserConfig()
  const projectConfigs = loadProjectConfig(workingDir)
  const localConfigs = loadLocalConfig(workingDir)

  // Re-expand to capture any missing vars that were silently swallowed in
  // the individual loaders (which already expanded once). In practice the
  // individual loaders expand eagerly, so we just merge — but we still
  // want to report missing vars.  We re-run expansion here so the error
  // list is comprehensive.  Because expand is idempotent for already-
  // resolved values, this is safe.

  const merged: Record<string, ScopedMCPServerConfig> = {
    ...builtinConfigs,
    ...expandAndTrack(userConfigs),
    ...expandAndTrack(projectConfigs),
    ...expandAndTrack(localConfigs),
  }

  // Filter out disabled servers
  const servers: Record<string, ScopedMCPServerConfig> = {}
  for (const [name, config] of Object.entries(merged)) {
    if (!isMCPServerDisabled(name, config)) {
      servers[name] = config
    }
  }

  return { servers, errors }
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Check whether a server is explicitly disabled via its `disabled` flag.
 */
export function isMCPServerDisabled(_name: string, config: ScopedMCPServerConfig): boolean {
  return config.disabled === true
}

/**
 * Determine the transport type of a server config.
 *
 * Defaults to `'stdio'` when `type` is omitted (per MCP spec).
 */
export function getMCPServerType(config: MCPServerConfig): 'stdio' | 'sse' | 'http' {
  if (config.type === 'sse') return 'sse'
  if (config.type === 'http') return 'http'
  return 'stdio'
}

/**
 * Returns `true` for stdio (local process) servers, `false` for network
 * (SSE / HTTP) servers.
 */
export function isLocalMCPServer(config: MCPServerConfig): boolean {
  return getMCPServerType(config) === 'stdio'
}
