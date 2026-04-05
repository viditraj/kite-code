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
import type { ThemeName } from '../themes/themes.js';
export interface ProviderConfig {
    /** Provider name: 'anthropic' | 'openai' | 'ollama' | 'groq' | 'gemini' | 'deepseek' | 'mistral' | 'openrouter' | custom */
    name: string;
    /** Model identifier (e.g., 'claude-sonnet-4-20250514', 'gpt-4o', 'gemma4') */
    model: string;
    /** Environment variable name that holds the API key */
    apiKeyEnv: string;
    /** Custom API base URL (for self-hosted endpoints) */
    apiBaseUrl: string;
    /** Maximum context window tokens */
    maxContextLength?: number;
    /** Extra headers to send with API requests */
    extraHeaders?: Record<string, string>;
    /** Extra payload fields to merge into every request */
    extraPayload?: Record<string, unknown>;
    /** Whether to verify SSL certificates (default: true) */
    verifySsl?: boolean;
}
export interface BehaviorConfig {
    /** Permission mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' */
    permissionMode: string;
    /** Maximum output tokens per response */
    maxTokens: number;
    /** Maximum session cost in USD (0 = unlimited) */
    maxCostUsd: number;
}
export interface FeaturesConfig {
    /** Enable vim mode in the input area */
    vimMode: boolean;
    /** Enable the memory/dream system */
    memorySystem: boolean;
    /** Enable skill loading */
    skills: boolean;
    /** Enable MCP server connections */
    mcp: boolean;
    /** Enable tool search (deferred loading) */
    toolSearch: boolean;
}
export interface CostEntry {
    /** Cost per million input tokens in USD */
    input: number;
    /** Cost per million output tokens in USD */
    output: number;
}
export interface PermissionRulesConfig {
    allow: string[];
    ask: string[];
    deny: string[];
}
export interface KiteConfig {
    provider: ProviderConfig;
    behavior: BehaviorConfig;
    features: FeaturesConfig;
    permissions: PermissionRulesConfig;
    costs: Record<string, CostEntry>;
    /** Resolved path of the config file that was loaded */
    configPath: string | null;
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
export declare function loadConfig(cliConfigPath?: string): KiteConfig;
/**
 * Get the API key for the configured provider.
 */
export declare function getApiKey(config: KiteConfig): string | undefined;
export interface GlobalConfig {
    /** Selected color theme */
    theme?: ThemeName;
    /** Has the user completed the onboarding walkthrough? */
    hasCompletedOnboarding?: boolean;
    /** Version string when onboarding was last completed */
    lastOnboardingVersion?: string;
    /** Provider config (saved during onboarding/setup) */
    provider?: Partial<ProviderConfig>;
}
/**
 * Get the user-level global config from ~/.kite/config.json.
 * Returns cached value after the first read.
 */
export declare function getGlobalConfig(): GlobalConfig;
/**
 * Update the global config. Accepts an updater function (same pattern as
 * Claude Code's saveGlobalConfig) that receives the current config and
 * returns the updated config.
 */
export declare function saveGlobalConfig(updater: (current: GlobalConfig) => GlobalConfig): void;
/**
 * Mark the onboarding walkthrough as completed.
 * Saves the flag + current version to global config.
 */
export declare function completeOnboarding(): void;
/** Reset the global config cache (for testing). */
export declare function resetGlobalConfigCache(): void;
//# sourceMappingURL=config.d.ts.map