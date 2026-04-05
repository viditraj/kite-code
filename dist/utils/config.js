/**
 * Kite configuration system.
 *
 * Replaces Claude Code's GrowthBook remote feature flags with local JSON config.
 * Replaces Anthropic OAuth with API key from environment variables.
 *
 * Config loading order (lowest to highest priority):
 * 1. Built-in defaults
 * 2. Global config: ~/.kite/config.json
 * 3. Project config: ./kite.config.json
 * 4. CLI flags
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
// ============================================================================
// Default Cost Table
// ============================================================================
const DEFAULT_COSTS = {
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
    'claude-haiku-3-5-20241022': { input: 0.8, output: 4.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'o1': { input: 15.0, output: 60.0 },
    'o3': { input: 10.0, output: 40.0 },
    'llama-3.1-70b': { input: 0.0, output: 0.0 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'mistral-large-latest': { input: 2.0, output: 6.0 },
};
// ============================================================================
// Default Config
// ============================================================================
function createDefaultConfig() {
    return {
        provider: {
            name: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
            apiBaseUrl: '',
            verifySsl: true,
        },
        behavior: {
            permissionMode: 'default',
            maxTokens: 8192,
            maxCostUsd: 0,
        },
        features: {
            vimMode: true,
            memorySystem: true,
            skills: true,
            mcp: true,
            toolSearch: true,
        },
        permissions: {
            allow: [],
            ask: [],
            deny: [],
        },
        costs: { ...DEFAULT_COSTS },
        configPath: null,
    };
}
// ============================================================================
// Config Loading
// ============================================================================
function findConfigFiles(cliConfigPath) {
    const files = [];
    // 1. Global config
    const globalConfig = join(homedir(), '.kite', 'config.json');
    if (existsSync(globalConfig)) {
        files.push(globalConfig);
    }
    // 2. Project config (walk up from cwd)
    if (cliConfigPath) {
        const resolved = resolve(cliConfigPath);
        if (existsSync(resolved)) {
            files.push(resolved);
        }
    }
    else {
        let dir = process.cwd();
        while (true) {
            const candidate = join(dir, 'kite.config.json');
            if (existsSync(candidate)) {
                files.push(candidate);
                break;
            }
            const parent = resolve(dir, '..');
            if (parent === dir)
                break;
            dir = parent;
        }
    }
    return files;
}
function parseJsonFile(path) {
    try {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
function deepMerge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (key in result &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)) {
            result[key] = deepMerge(result[key], value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function applyConfigData(config, data) {
    const provider = data.provider;
    if (provider) {
        if (typeof provider.name === 'string')
            config.provider.name = provider.name;
        if (typeof provider.model === 'string')
            config.provider.model = provider.model;
        if (typeof provider.apiKeyEnv === 'string')
            config.provider.apiKeyEnv = provider.apiKeyEnv;
        if (typeof provider.apiBaseUrl === 'string')
            config.provider.apiBaseUrl = provider.apiBaseUrl;
        if (typeof provider.maxContextLength === 'number')
            config.provider.maxContextLength = provider.maxContextLength;
        if (typeof provider.verifySsl === 'boolean')
            config.provider.verifySsl = provider.verifySsl;
        if (typeof provider.extraHeaders === 'object' && provider.extraHeaders !== null) {
            config.provider.extraHeaders = provider.extraHeaders;
        }
        if (typeof provider.extraPayload === 'object' && provider.extraPayload !== null) {
            config.provider.extraPayload = provider.extraPayload;
        }
    }
    const behavior = data.behavior;
    if (behavior) {
        if (typeof behavior.permissionMode === 'string')
            config.behavior.permissionMode = behavior.permissionMode;
        if (typeof behavior.maxTokens === 'number')
            config.behavior.maxTokens = behavior.maxTokens;
        if (typeof behavior.maxCostUsd === 'number')
            config.behavior.maxCostUsd = behavior.maxCostUsd;
    }
    const features = data.features;
    if (features) {
        if (typeof features.vimMode === 'boolean')
            config.features.vimMode = features.vimMode;
        if (typeof features.memorySystem === 'boolean')
            config.features.memorySystem = features.memorySystem;
        if (typeof features.skills === 'boolean')
            config.features.skills = features.skills;
        if (typeof features.mcp === 'boolean')
            config.features.mcp = features.mcp;
        if (typeof features.toolSearch === 'boolean')
            config.features.toolSearch = features.toolSearch;
    }
    const permissions = data.permissions;
    if (permissions) {
        const rules = permissions.rules;
        if (rules) {
            if (Array.isArray(rules.allow))
                config.permissions.allow = rules.allow.filter((s) => typeof s === 'string');
            if (Array.isArray(rules.ask))
                config.permissions.ask = rules.ask.filter((s) => typeof s === 'string');
            if (Array.isArray(rules.deny))
                config.permissions.deny = rules.deny.filter((s) => typeof s === 'string');
        }
    }
    const costs = data.costs;
    if (costs) {
        for (const [model, entry] of Object.entries(costs)) {
            if (typeof entry === 'object' && entry !== null) {
                const e = entry;
                if (typeof e.input === 'number' && typeof e.output === 'number') {
                    config.costs[model] = { input: e.input, output: e.output };
                }
            }
        }
    }
}
/**
 * Load and merge configuration from all sources.
 *
 * Priority (highest to lowest):
 * 1. CLI overrides (applied by caller after loading)
 * 2. Project kite.config.json
 * 3. Global ~/.kite/config.json
 * 4. Built-in defaults
 */
export function loadConfig(cliConfigPath) {
    const config = createDefaultConfig();
    const files = findConfigFiles(cliConfigPath);
    for (const path of files) {
        const data = parseJsonFile(path);
        applyConfigData(config, data);
        config.configPath = path;
    }
    // Ensure default costs exist for any models not overridden
    for (const [model, cost] of Object.entries(DEFAULT_COSTS)) {
        if (!(model in config.costs)) {
            config.costs[model] = cost;
        }
    }
    return config;
}
/**
 * Get the API key for the configured provider.
 */
export function getApiKey(config) {
    return (process.env[config.provider.apiKeyEnv] ||
        process.env['KITE_API_KEY'] ||
        undefined);
}
const GLOBAL_CONFIG_PATH = join(homedir(), '.kite', 'config.json');
let globalConfigCache = null;
/**
 * Get the user-level global config from ~/.kite/config.json.
 * Returns cached value after the first read.
 */
export function getGlobalConfig() {
    if (globalConfigCache)
        return globalConfigCache;
    if (!existsSync(GLOBAL_CONFIG_PATH)) {
        globalConfigCache = {};
        return globalConfigCache;
    }
    try {
        const raw = readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
        globalConfigCache = JSON.parse(raw);
        return globalConfigCache;
    }
    catch {
        globalConfigCache = {};
        return globalConfigCache;
    }
}
/**
 * Update the global config. Accepts an updater function (same pattern as
 * Claude Code's saveGlobalConfig) that receives the current config and
 * returns the updated config.
 */
export function saveGlobalConfig(updater) {
    const current = getGlobalConfig();
    const updated = updater(current);
    // Skip write if same reference returned (no changes)
    if (updated === current)
        return;
    const dir = join(homedir(), '.kite');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    globalConfigCache = updated;
}
/**
 * Mark the onboarding walkthrough as completed.
 * Saves the flag + current version to global config.
 */
export function completeOnboarding() {
    saveGlobalConfig(current => ({
        ...current,
        hasCompletedOnboarding: true,
        lastOnboardingVersion: '0.1.0',
    }));
}
/** Reset the global config cache (for testing). */
export function resetGlobalConfigCache() {
    globalConfigCache = null;
}
//# sourceMappingURL=config.js.map