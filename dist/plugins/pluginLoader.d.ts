/**
 * Plugin system — load and manage plugins from .kite/plugins/.
 *
 * Adapted from Claude Code's plugin architecture for Kite.
 * Plugins are directories under .kite/plugins/ (or ~/.kite/plugins/) that
 * contain a manifest file (plugin.json) and optional TypeScript/JavaScript
 * modules for tools, commands, and hooks.
 *
 * Plugin manifest format:
 *   {
 *     "name": "my-plugin",
 *     "version": "1.0.0",
 *     "description": "Does something useful",
 *     "author": "Someone",
 *     "tools": ["./tools/myTool.js"],
 *     "commands": ["./commands/myCommand.js"],
 *     "hooks": { "onSessionStart": "./hooks/onStart.js" }
 *   }
 *
 * Each tool module should export a default Tool object.
 * Each command module should export a default Command object.
 * Hook modules should export a default async function.
 */
import type { Tool } from '../Tool.js';
import type { Command } from '../types/command.js';
export interface PluginManifest {
    /** Unique plugin name (kebab-case recommended) */
    name: string;
    /** Semver version string */
    version: string;
    /** Human-readable description */
    description: string;
    /** Author name or identifier */
    author?: string;
    /** Relative paths to tool module files */
    tools?: string[];
    /** Relative paths to command module files */
    commands?: string[];
    /** Hook name → relative path to handler module */
    hooks?: Record<string, string>;
    /** Required Kite version range (semver, not enforced yet) */
    kiteVersion?: string;
    /** Whether the plugin is disabled */
    disabled?: boolean;
}
export interface LoadedPlugin {
    /** Parsed manifest */
    manifest: PluginManifest;
    /** Absolute path to the plugin directory */
    pluginDir: string;
    /** Successfully loaded Tool objects */
    tools: Tool[];
    /** Successfully loaded Command objects */
    commands: Command[];
    /** Hook name → loaded handler function */
    hooks: Map<string, PluginHookFn>;
    /** Errors encountered during loading */
    errors: PluginError[];
}
export interface PluginError {
    pluginName: string;
    phase: 'manifest' | 'tool' | 'command' | 'hook';
    message: string;
    path?: string;
}
export type PluginHookFn = (...args: unknown[]) => Promise<void>;
/**
 * Find all plugin directories.
 * Searches:
 *   1. .kite/plugins/ in the project directory
 *   2. ~/.kite/plugins/ for global plugins
 */
export declare function discoverPluginDirs(cwd: string): string[];
/**
 * Parse a plugin manifest from a plugin directory.
 * Returns null if the manifest is missing or invalid.
 */
export declare function parseManifest(pluginDir: string): {
    manifest: PluginManifest;
    errors: PluginError[];
} | null;
/**
 * Load a single plugin from its directory.
 */
export declare function loadPlugin(pluginDir: string): Promise<LoadedPlugin | null>;
/**
 * Load all plugins from .kite/plugins/ (project + global).
 *
 * @param cwd - Current working directory (for project-level plugins)
 * @returns Array of loaded plugins and aggregate errors
 */
export declare function loadAllPlugins(cwd: string): Promise<{
    plugins: LoadedPlugin[];
    errors: PluginError[];
}>;
/**
 * Execute a named hook across all loaded plugins.
 * Hooks run in parallel. Errors are collected, not thrown.
 */
export declare function executePluginHook(plugins: LoadedPlugin[], hookName: string, ...args: unknown[]): Promise<PluginError[]>;
/**
 * Get loaded plugins (cached after first load).
 */
export declare function getLoadedPlugins(): LoadedPlugin[];
/**
 * Set the plugin cache after loading.
 */
export declare function setLoadedPlugins(plugins: LoadedPlugin[]): void;
/**
 * Clear the plugin cache.
 */
export declare function clearPluginCache(): void;
/**
 * Get all tools from loaded plugins.
 */
export declare function getPluginTools(): Tool[];
/**
 * Get all commands from loaded plugins.
 */
export declare function getPluginCommands(): Command[];
//# sourceMappingURL=pluginLoader.d.ts.map