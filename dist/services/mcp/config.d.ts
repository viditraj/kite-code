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
import { type MCPServerConfig, type ScopedMCPServerConfig } from './types.js';
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
export declare function expandEnvVars(value: string): {
    expanded: string;
    missingVars: string[];
};
/**
 * Expand environment variables in all string fields of an MCP server config.
 *
 * For stdio configs: expands command, args entries, and env values.
 * For SSE / HTTP configs: expands url and header values.
 */
export declare function expandConfigEnvVars(config: MCPServerConfig): {
    expanded: MCPServerConfig;
    missingVars: string[];
};
/**
 * Load and parse an MCP config file.
 *
 * The file must be JSON with the shape `{ mcpServers: Record<string, MCPServerConfig> }`.
 * Returns an empty record when the file doesn't exist or fails validation.
 */
export declare function loadMCPConfigFile(filePath: string): Record<string, MCPServerConfig>;
/**
 * Walk up from `cwd` toward the filesystem root looking for an MCP config file
 * (`.mcp.json` or `mcp.json`).
 *
 * Returns the absolute path to the first match, or `null` if none is found.
 */
export declare function findProjectConfig(cwd: string): string | null;
/**
 * Load user-level MCP config from `~/.kite/config.json`.
 *
 * The file may contain a top-level `mcpServers` key.  Each entry is tagged
 * with `scope: 'user'` and has its environment variables expanded.
 */
export declare function loadUserConfig(): Record<string, ScopedMCPServerConfig>;
/**
 * Load project-level MCP config by searching for `.mcp.json` / `mcp.json`
 * starting from `cwd` and walking up the directory tree.
 *
 * Each entry is tagged with `scope: 'project'` and has its environment
 * variables expanded.
 */
export declare function loadProjectConfig(cwd: string): Record<string, ScopedMCPServerConfig>;
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
export declare function loadLocalConfig(cwd: string): Record<string, ScopedMCPServerConfig>;
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
export declare function getAllMCPConfigs(cwd?: string): {
    servers: Record<string, ScopedMCPServerConfig>;
    errors: string[];
};
/**
 * Check whether a server is explicitly disabled via its `disabled` flag.
 */
export declare function isMCPServerDisabled(_name: string, config: ScopedMCPServerConfig): boolean;
/**
 * Determine the transport type of a server config.
 *
 * Defaults to `'stdio'` when `type` is omitted (per MCP spec).
 */
export declare function getMCPServerType(config: MCPServerConfig): 'stdio' | 'sse' | 'http';
/**
 * Returns `true` for stdio (local process) servers, `false` for network
 * (SSE / HTTP) servers.
 */
export declare function isLocalMCPServer(config: MCPServerConfig): boolean;
//# sourceMappingURL=config.d.ts.map