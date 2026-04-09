/**
 * MCP Marketplace installer — adds MCP servers to the local configuration.
 *
 * When a user selects an MCP server from the marketplace, this module:
 * 1. Fetches the server detail page to extract the standard config
 * 2. Writes the config to the appropriate scope (.mcp.json or ~/.kite/config.json)
 * 3. Optionally triggers an MCP reconnect so the server is immediately available
 *
 * Follows the same config format as existing MCP server configuration.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { MCPInstallConfig, InstallScope } from './types.js'
import { getServerDetail } from './client.js'

// ============================================================================
// Constants
// ============================================================================

const KITE_CONFIG_DIR = '.kite'
const USER_CONFIG_PATH = join(homedir(), KITE_CONFIG_DIR, 'config.json')

// ============================================================================
// Install Result
// ============================================================================

export interface InstallResult {
  success: boolean
  message: string
  serverName: string
  configPath: string
  config: MCPInstallConfig['config']
}

// ============================================================================
// Config File Helpers
// ============================================================================

/**
 * Read and parse a JSON config file, returning an empty object if missing/invalid.
 */
function readJsonConfig(filePath: string): Record<string, unknown> {
  try {
    if (!existsSync(filePath)) return {}
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Write a JSON config file, creating parent directories if needed.
 */
function writeJsonConfig(filePath: string, data: Record<string, unknown>): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Install an MCP server from its marketplace config.
 *
 * @param installConfig - The parsed MCP config from the marketplace
 * @param scope - Where to install: 'project' (.mcp.json in cwd) or 'user' (~/.kite/config.json)
 * @param cwd - Current working directory (used for project scope)
 */
export function installMCPServer(
  installConfig: MCPInstallConfig,
  scope: InstallScope,
  cwd: string,
): InstallResult {
  const { serverName, config } = installConfig

  const configPath = scope === 'user'
    ? USER_CONFIG_PATH
    : join(cwd, '.mcp.json')

  try {
    const existing = readJsonConfig(configPath)

    // Ensure mcpServers key exists
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
      existing.mcpServers = {}
    }

    const mcpServers = existing.mcpServers as Record<string, unknown>

    // Check if already installed
    if (mcpServers[serverName]) {
      return {
        success: false,
        message: `Server "${serverName}" is already configured in ${configPath}. Use /mcp to check its status.`,
        serverName,
        configPath,
        config,
      }
    }

    // Build the config entry
    const entry: Record<string, unknown> = {}
    if (config.type && config.type !== 'stdio') {
      entry.type = config.type
    }
    if (config.command) entry.command = config.command
    if (config.args?.length) entry.args = config.args
    if (config.env && Object.keys(config.env).length > 0) entry.env = config.env
    if (config.url) entry.url = config.url
    if (config.headers && Object.keys(config.headers).length > 0) entry.headers = config.headers

    mcpServers[serverName] = entry
    writeJsonConfig(configPath, existing)

    return {
      success: true,
      message: `Installed "${serverName}" to ${configPath}. Restart Kite or run /mcp to connect.`,
      serverName,
      configPath,
      config,
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Failed to install "${serverName}": ${errMsg}`,
      serverName,
      configPath,
      config,
    }
  }
}

/**
 * Install an MCP server from its marketplace path.
 *
 * Fetches the detail page, extracts config, and writes it to the config file.
 */
export async function installFromMarketplace(
  serverPath: string,
  scope: InstallScope,
  cwd: string,
): Promise<InstallResult> {
  const detail = await getServerDetail(serverPath)

  if (!detail.standardConfig) {
    return {
      success: false,
      message: `Could not extract install config for "${detail.name}". The server may require manual configuration. Check: https://mcpservers.org${detail.path}`,
      serverName: detail.name.toLowerCase().replace(/\s+/g, '-'),
      configPath: scope === 'user' ? USER_CONFIG_PATH : join(cwd, '.mcp.json'),
      config: { command: '' },
    }
  }

  return installMCPServer(detail.standardConfig, scope, cwd)
}

/**
 * Uninstall an MCP server by removing it from the config file.
 */
export function uninstallMCPServer(
  serverName: string,
  scope: InstallScope,
  cwd: string,
): InstallResult {
  const configPath = scope === 'user'
    ? USER_CONFIG_PATH
    : join(cwd, '.mcp.json')

  try {
    const existing = readJsonConfig(configPath)
    const mcpServers = (existing.mcpServers ?? {}) as Record<string, unknown>

    if (!mcpServers[serverName]) {
      return {
        success: false,
        message: `Server "${serverName}" not found in ${configPath}.`,
        serverName,
        configPath,
        config: { command: '' },
      }
    }

    delete mcpServers[serverName]
    existing.mcpServers = mcpServers
    writeJsonConfig(configPath, existing)

    return {
      success: true,
      message: `Removed "${serverName}" from ${configPath}. Restart Kite to disconnect.`,
      serverName,
      configPath,
      config: { command: '' },
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Failed to uninstall "${serverName}": ${errMsg}`,
      serverName,
      configPath,
      config: { command: '' },
    }
  }
}

/**
 * List all currently installed MCP servers from all config scopes.
 */
export function listInstalledServers(
  cwd: string,
): Array<{ name: string; scope: string; config: Record<string, unknown> }> {
  const results: Array<{ name: string; scope: string; config: Record<string, unknown> }> = []

  // Project scope: .mcp.json
  const projectPath = join(cwd, '.mcp.json')
  const projectConfig = readJsonConfig(projectPath)
  const projectServers = (projectConfig.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  for (const [name, config] of Object.entries(projectServers)) {
    results.push({ name, scope: 'project', config })
  }

  // User scope: ~/.kite/config.json
  const userConfig = readJsonConfig(USER_CONFIG_PATH)
  const userServers = (userConfig.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  for (const [name, config] of Object.entries(userServers)) {
    results.push({ name, scope: 'user', config })
  }

  return results
}
