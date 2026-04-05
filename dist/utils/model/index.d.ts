/**
 * Model detection, pricing, canonical names, context windows.
 *
 * Central registry of model metadata used across the codebase for:
 * - Resolving user-friendly aliases to canonical model IDs
 * - Looking up pricing to calculate and display costs
 * - Determining context window sizes and max output tokens
 * - Querying model capabilities (vision, thinking, caching, etc.)
 */
import type { TokenUsage } from '../../providers/types.js';
export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
    cacheReadPer1M?: number;
    cacheWritePer1M?: number;
}
export declare const MODEL_PRICING: Record<string, ModelPricing>;
export declare const MODEL_CONTEXT_WINDOWS: Record<string, number>;
export declare const MODEL_MAX_OUTPUT: Record<string, number>;
export declare const MODEL_ALIASES: Record<string, string>;
export interface ModelCapabilities {
    contextWindow: number;
    maxOutput: number;
    supportsThinking: boolean;
    supportsVision: boolean;
    supportsToolUse: boolean;
    supportsCaching: boolean;
}
/**
 * Resolve a model alias to its canonical name.
 * If the input is not a known alias, it is returned as-is.
 */
export declare function resolveModelAlias(modelNameOrAlias: string): string;
/**
 * Get the canonical model name: resolve alias, then normalize.
 */
export declare function getCanonicalName(model: string): string;
/**
 * Get the context window size for a model.
 * Tries exact match, then prefix match, then returns the default (128000).
 */
export declare function getContextWindowForModel(model: string): number;
/**
 * Get the max output tokens for a model.
 * Tries exact match, then prefix match, then returns the default (8192).
 */
export declare function getModelMaxOutputTokens(model: string): number;
/**
 * Get pricing for a model.
 * Tries exact match, then prefix match, then returns null.
 */
export declare function getModelPricing(model: string): ModelPricing | null;
/**
 * Calculate cost in USD from token usage and model.
 *
 * Formula:
 *   (input × inputPer1M + output × outputPer1M
 *    + cacheRead × cacheReadPer1M + cacheWrite × cacheWritePer1M) / 1_000_000
 *
 * Returns 0 if no pricing data is found for the model.
 */
export declare function calculateUSDCost(usage: TokenUsage, model: string): number;
/**
 * Format a USD cost for display.
 *
 * - < $0.01 → "$0.00"
 * - < $1    → "$0.XX"
 * - ≥ $1    → "$X.XX"
 */
export declare function formatCost(usd: number): string;
/**
 * Format pricing info for display.
 * Returns a string like "$3.00/1M in, $15.00/1M out".
 * Returns "pricing unavailable" if no pricing data is found.
 */
export declare function formatModelPricing(model: string): string;
/**
 * Format model name for display: canonical name with alias if different.
 *
 * If the input was an alias, returns something like:
 *   "claude-sonnet-4-20250514 (sonnet)"
 * Otherwise, just the canonical name.
 */
export declare function renderModelName(model: string): string;
/**
 * Check if a name is a known model alias.
 */
export declare function isModelAlias(name: string): boolean;
/**
 * Return the cheapest/fastest model available.
 * Checks KITE_SMALL_FAST_MODEL env var first, then falls back to haiku.
 */
export declare function getSmallFastModel(): string;
/**
 * Determine model capabilities from the model name.
 *
 * Capabilities are inferred from the canonical model ID:
 * - Anthropic (claude-*): thinking, vision, tool use, caching
 * - OpenAI (gpt-*, o1*): vision, tool use (no caching or thinking)
 * - DeepSeek: tool use only
 * - Mistral: tool use only
 * - Google (gemini-*): vision, tool use
 * - Unknown models: conservative defaults (tool use only)
 */
export declare function getModelCapabilities(model: string): ModelCapabilities;
//# sourceMappingURL=index.d.ts.map