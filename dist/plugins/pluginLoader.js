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
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';
import { pathToFileURL } from 'url';
// ============================================================================
// Constants
// ============================================================================
const KITE_DIR = '.kite';
const PLUGINS_DIR = 'plugins';
const MANIFEST_FILENAME = 'plugin.json';
const GLOBAL_PLUGINS_DIR = join(homedir(), KITE_DIR, PLUGINS_DIR);
// ============================================================================
// Plugin discovery
// ============================================================================
/**
 * Find all plugin directories.
 * Searches:
 *   1. .kite/plugins/ in the project directory
 *   2. ~/.kite/plugins/ for global plugins
 */
export function discoverPluginDirs(cwd) {
    const dirs = [];
    // Project-level plugins
    const projectPluginsDir = join(cwd, KITE_DIR, PLUGINS_DIR);
    if (existsSync(projectPluginsDir)) {
        try {
            const entries = readdirSync(projectPluginsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const pluginDir = join(projectPluginsDir, entry.name);
                    if (existsSync(join(pluginDir, MANIFEST_FILENAME))) {
                        dirs.push(pluginDir);
                    }
                }
            }
        }
        catch {
            // Silently skip unreadable directories
        }
    }
    // Global plugins
    if (existsSync(GLOBAL_PLUGINS_DIR)) {
        try {
            const entries = readdirSync(GLOBAL_PLUGINS_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const pluginDir = join(GLOBAL_PLUGINS_DIR, entry.name);
                    // Skip if already loaded from project level (project takes precedence)
                    const name = entry.name;
                    if (dirs.some(d => basename(d) === name))
                        continue;
                    if (existsSync(join(pluginDir, MANIFEST_FILENAME))) {
                        dirs.push(pluginDir);
                    }
                }
            }
        }
        catch {
            // Silently skip unreadable directories
        }
    }
    return dirs;
}
// ============================================================================
// Manifest parsing
// ============================================================================
/**
 * Parse a plugin manifest from a plugin directory.
 * Returns null if the manifest is missing or invalid.
 */
export function parseManifest(pluginDir) {
    const manifestPath = join(pluginDir, MANIFEST_FILENAME);
    if (!existsSync(manifestPath))
        return null;
    try {
        const raw = readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Validate required fields
        if (typeof parsed.name !== 'string' || !parsed.name) {
            return null;
        }
        if (typeof parsed.version !== 'string' || !parsed.version) {
            return null;
        }
        if (typeof parsed.description !== 'string') {
            parsed.description = '';
        }
        const errors = [];
        // Validate tool paths
        if (parsed.tools && !Array.isArray(parsed.tools)) {
            errors.push({
                pluginName: parsed.name,
                phase: 'manifest',
                message: '"tools" must be an array of file paths',
            });
            parsed.tools = [];
        }
        // Validate command paths
        if (parsed.commands && !Array.isArray(parsed.commands)) {
            errors.push({
                pluginName: parsed.name,
                phase: 'manifest',
                message: '"commands" must be an array of file paths',
            });
            parsed.commands = [];
        }
        // Validate hooks
        if (parsed.hooks && typeof parsed.hooks !== 'object') {
            errors.push({
                pluginName: parsed.name,
                phase: 'manifest',
                message: '"hooks" must be an object mapping hook names to file paths',
            });
            parsed.hooks = {};
        }
        return { manifest: parsed, errors };
    }
    catch (err) {
        return null;
    }
}
// ============================================================================
// Module loading
// ============================================================================
/**
 * Load a JavaScript/TypeScript module from a plugin directory.
 * Uses dynamic import() with proper file:// URL resolution.
 */
async function loadModule(pluginDir, relativePath) {
    const absolutePath = resolve(pluginDir, relativePath);
    if (!existsSync(absolutePath)) {
        throw new Error(`Module not found: ${relativePath}`);
    }
    const fileUrl = pathToFileURL(absolutePath).href;
    const mod = await import(fileUrl);
    return mod.default ?? mod;
}
/**
 * Load tool modules from a plugin.
 */
async function loadPluginTools(manifest, pluginDir) {
    const tools = [];
    const errors = [];
    if (!manifest.tools)
        return { tools, errors };
    for (const toolPath of manifest.tools) {
        try {
            const toolModule = await loadModule(pluginDir, toolPath);
            if (toolModule && typeof toolModule === 'object' && 'name' in toolModule) {
                tools.push(toolModule);
            }
            else {
                errors.push({
                    pluginName: manifest.name,
                    phase: 'tool',
                    message: `Module does not export a valid Tool object`,
                    path: toolPath,
                });
            }
        }
        catch (err) {
            errors.push({
                pluginName: manifest.name,
                phase: 'tool',
                message: err.message,
                path: toolPath,
            });
        }
    }
    return { tools, errors };
}
/**
 * Load command modules from a plugin.
 */
async function loadPluginCommands(manifest, pluginDir) {
    const commands = [];
    const errors = [];
    if (!manifest.commands)
        return { commands, errors };
    for (const cmdPath of manifest.commands) {
        try {
            const cmdModule = await loadModule(pluginDir, cmdPath);
            if (cmdModule && typeof cmdModule === 'object' && 'name' in cmdModule) {
                commands.push(cmdModule);
            }
            else {
                errors.push({
                    pluginName: manifest.name,
                    phase: 'command',
                    message: `Module does not export a valid Command object`,
                    path: cmdPath,
                });
            }
        }
        catch (err) {
            errors.push({
                pluginName: manifest.name,
                phase: 'command',
                message: err.message,
                path: cmdPath,
            });
        }
    }
    return { commands, errors };
}
/**
 * Load hook handlers from a plugin.
 */
async function loadPluginHooks(manifest, pluginDir) {
    const hooks = new Map();
    const errors = [];
    if (!manifest.hooks)
        return { hooks, errors };
    for (const [hookName, hookPath] of Object.entries(manifest.hooks)) {
        try {
            const hookFn = await loadModule(pluginDir, hookPath);
            if (typeof hookFn === 'function') {
                hooks.set(hookName, hookFn);
            }
            else {
                errors.push({
                    pluginName: manifest.name,
                    phase: 'hook',
                    message: `Module does not export a function`,
                    path: hookPath,
                });
            }
        }
        catch (err) {
            errors.push({
                pluginName: manifest.name,
                phase: 'hook',
                message: err.message,
                path: hookPath,
            });
        }
    }
    return { hooks, errors };
}
// ============================================================================
// Plugin loading
// ============================================================================
/**
 * Load a single plugin from its directory.
 */
export async function loadPlugin(pluginDir) {
    const parsed = parseManifest(pluginDir);
    if (!parsed)
        return null;
    const { manifest, errors: manifestErrors } = parsed;
    // Skip disabled plugins
    if (manifest.disabled)
        return null;
    const [toolResult, cmdResult, hookResult] = await Promise.all([
        loadPluginTools(manifest, pluginDir),
        loadPluginCommands(manifest, pluginDir),
        loadPluginHooks(manifest, pluginDir),
    ]);
    return {
        manifest,
        pluginDir,
        tools: toolResult.tools,
        commands: cmdResult.commands,
        hooks: hookResult.hooks,
        errors: [
            ...manifestErrors,
            ...toolResult.errors,
            ...cmdResult.errors,
            ...hookResult.errors,
        ],
    };
}
/**
 * Load all plugins from .kite/plugins/ (project + global).
 *
 * @param cwd - Current working directory (for project-level plugins)
 * @returns Array of loaded plugins and aggregate errors
 */
export async function loadAllPlugins(cwd) {
    const pluginDirs = discoverPluginDirs(cwd);
    const plugins = [];
    const errors = [];
    const loadPromises = pluginDirs.map(async (dir) => {
        try {
            const loaded = await loadPlugin(dir);
            if (loaded) {
                plugins.push(loaded);
                errors.push(...loaded.errors);
            }
        }
        catch (err) {
            errors.push({
                pluginName: basename(dir),
                phase: 'manifest',
                message: `Failed to load plugin: ${err.message}`,
                path: dir,
            });
        }
    });
    await Promise.all(loadPromises);
    return { plugins, errors };
}
// ============================================================================
// Plugin hook execution
// ============================================================================
/**
 * Execute a named hook across all loaded plugins.
 * Hooks run in parallel. Errors are collected, not thrown.
 */
export async function executePluginHook(plugins, hookName, ...args) {
    const errors = [];
    const hookPromises = plugins
        .filter(p => p.hooks.has(hookName))
        .map(async (plugin) => {
        const hookFn = plugin.hooks.get(hookName);
        try {
            await hookFn(...args);
        }
        catch (err) {
            errors.push({
                pluginName: plugin.manifest.name,
                phase: 'hook',
                message: `Hook '${hookName}' failed: ${err.message}`,
            });
        }
    });
    await Promise.all(hookPromises);
    return errors;
}
// ============================================================================
// Plugin cache
// ============================================================================
let cachedPlugins = null;
/**
 * Get loaded plugins (cached after first load).
 */
export function getLoadedPlugins() {
    return cachedPlugins ?? [];
}
/**
 * Set the plugin cache after loading.
 */
export function setLoadedPlugins(plugins) {
    cachedPlugins = plugins;
}
/**
 * Clear the plugin cache.
 */
export function clearPluginCache() {
    cachedPlugins = null;
}
/**
 * Get all tools from loaded plugins.
 */
export function getPluginTools() {
    return getLoadedPlugins().flatMap(p => p.tools);
}
/**
 * Get all commands from loaded plugins.
 */
export function getPluginCommands() {
    return getLoadedPlugins().flatMap(p => p.commands);
}
//# sourceMappingURL=pluginLoader.js.map