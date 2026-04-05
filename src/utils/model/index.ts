/**
 * Model detection, pricing, canonical names, context windows.
 *
 * Central registry of model metadata used across the codebase for:
 * - Resolving user-friendly aliases to canonical model IDs
 * - Looking up pricing to calculate and display costs
 * - Determining context window sizes and max output tokens
 * - Querying model capabilities (vision, thinking, caching, etc.)
 */

import type { TokenUsage } from '../../providers/types.js'

// ============================================================================
// Model Pricing
// ============================================================================

export interface ModelPricing {
  inputPer1M: number // USD per 1M input tokens
  outputPer1M: number // USD per 1M output tokens
  cacheReadPer1M?: number
  cacheWritePer1M?: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': {
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  'claude-opus-4-20250514': {
    inputPer1M: 15,
    outputPer1M: 75,
    cacheReadPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
  'claude-3-5-sonnet-20241022': {
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  'claude-3-5-haiku-20241022': {
    inputPer1M: 0.8,
    outputPer1M: 4,
    cacheReadPer1M: 0.08,
    cacheWritePer1M: 1,
  },
  'claude-3-haiku-20240307': {
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    cacheReadPer1M: 0.03,
    cacheWritePer1M: 0.3,
  },
  // OpenAI
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
  'o1': { inputPer1M: 15, outputPer1M: 60 },
  'o1-mini': { inputPer1M: 3, outputPer1M: 12 },
  // DeepSeek
  'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
  'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
  // Mistral
  'mistral-large-latest': { inputPer1M: 2, outputPer1M: 6 },
  // Google
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
}

// ============================================================================
// Context Windows
// ============================================================================

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-sonnet-4-20250514': 200000,
  'claude-opus-4-20250514': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-3-haiku-20240307': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'o1': 200000,
  'o1-mini': 128000,
  'deepseek-chat': 128000,
  'deepseek-reasoner': 128000,
  'mistral-large-latest': 128000,
  'gemini-2.5-pro': 1048576,
  'gemini-2.5-flash': 1048576,
}

const DEFAULT_CONTEXT_WINDOW = 128000

// ============================================================================
// Max Output Tokens
// ============================================================================

export const MODEL_MAX_OUTPUT: Record<string, number> = {
  'claude-sonnet-4-20250514': 16384,
  'claude-opus-4-20250514': 16384,
  'claude-3-5-sonnet-20241022': 8192,
  'claude-3-5-haiku-20241022': 8192,
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'deepseek-chat': 8192,
  'mistral-large-latest': 8192,
}

const DEFAULT_MAX_OUTPUT = 8192

// ============================================================================
// Model Aliases
// ============================================================================

export const MODEL_ALIASES: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-3-5-haiku-20241022',
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-sonnet': 'claude-3-5-sonnet-20241022',
  'gpt4o': 'gpt-4o',
  'gpt4': 'gpt-4-turbo',
  '4o': 'gpt-4o',
  '4o-mini': 'gpt-4o-mini',
  'deepseek': 'deepseek-chat',
}

// ============================================================================
// Model Capabilities
// ============================================================================

export interface ModelCapabilities {
  contextWindow: number
  maxOutput: number
  supportsThinking: boolean
  supportsVision: boolean
  supportsToolUse: boolean
  supportsCaching: boolean
}

// ============================================================================
// Alias Resolution & Canonical Names
// ============================================================================

/**
 * Resolve a model alias to its canonical name.
 * If the input is not a known alias, it is returned as-is.
 */
export function resolveModelAlias(modelNameOrAlias: string): string {
  const lower = modelNameOrAlias.toLowerCase().trim()
  return MODEL_ALIASES[lower] ?? modelNameOrAlias
}

/**
 * Get the canonical model name: resolve alias, then normalize.
 */
export function getCanonicalName(model: string): string {
  const resolved = resolveModelAlias(model)
  // Normalize: lowercase and trim whitespace
  return resolved.toLowerCase().trim()
}

// ============================================================================
// Prefix Matching Helper
// ============================================================================

/**
 * Look up a value in a Record by exact key first, then by longest prefix match.
 * Returns undefined if nothing matches.
 */
function lookupWithPrefixMatch<T>(
  table: Record<string, T>,
  model: string,
): T | undefined {
  const canonical = getCanonicalName(model)

  // Exact match
  if (canonical in table) {
    return table[canonical]
  }

  // Prefix match: find the longest key that is a prefix of the canonical name
  let bestMatch: string | undefined
  let bestLength = 0
  for (const key of Object.keys(table)) {
    if (canonical.startsWith(key) && key.length > bestLength) {
      bestMatch = key
      bestLength = key.length
    }
  }

  return bestMatch !== undefined ? table[bestMatch] : undefined
}

// ============================================================================
// Context Window Lookup
// ============================================================================

/**
 * Get the context window size for a model.
 * Tries exact match, then prefix match, then returns the default (128000).
 */
export function getContextWindowForModel(model: string): number {
  return lookupWithPrefixMatch(MODEL_CONTEXT_WINDOWS, model) ?? DEFAULT_CONTEXT_WINDOW
}

// ============================================================================
// Max Output Tokens Lookup
// ============================================================================

/**
 * Get the max output tokens for a model.
 * Tries exact match, then prefix match, then returns the default (8192).
 */
export function getModelMaxOutputTokens(model: string): number {
  return lookupWithPrefixMatch(MODEL_MAX_OUTPUT, model) ?? DEFAULT_MAX_OUTPUT
}

// ============================================================================
// Pricing Lookup
// ============================================================================

/**
 * Get pricing for a model.
 * Tries exact match, then prefix match, then returns null.
 */
export function getModelPricing(model: string): ModelPricing | null {
  return lookupWithPrefixMatch(MODEL_PRICING, model) ?? null
}

// ============================================================================
// Cost Calculation & Formatting
// ============================================================================

/**
 * Calculate cost in USD from token usage and model.
 *
 * Formula:
 *   (input × inputPer1M + output × outputPer1M
 *    + cacheRead × cacheReadPer1M + cacheWrite × cacheWritePer1M) / 1_000_000
 *
 * Returns 0 if no pricing data is found for the model.
 */
export function calculateUSDCost(usage: TokenUsage, model: string): number {
  const pricing = getModelPricing(model)
  if (!pricing) {
    return 0
  }

  const inputCost = usage.inputTokens * pricing.inputPer1M
  const outputCost = usage.outputTokens * pricing.outputPer1M
  const cacheReadCost = usage.cacheReadInputTokens * (pricing.cacheReadPer1M ?? 0)
  const cacheWriteCost = usage.cacheCreationInputTokens * (pricing.cacheWritePer1M ?? 0)

  return (inputCost + outputCost + cacheReadCost + cacheWriteCost) / 1_000_000
}

/**
 * Format a USD cost for display.
 *
 * - < $0.01 → "$0.00"
 * - < $1    → "$0.XX"
 * - ≥ $1    → "$X.XX"
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) {
    return '$0.00'
  }
  return `$${usd.toFixed(2)}`
}

/**
 * Format pricing info for display.
 * Returns a string like "$3.00/1M in, $15.00/1M out".
 * Returns "pricing unavailable" if no pricing data is found.
 */
export function formatModelPricing(model: string): string {
  const pricing = getModelPricing(model)
  if (!pricing) {
    return 'pricing unavailable'
  }
  const inCost = `$${pricing.inputPer1M.toFixed(2)}/1M in`
  const outCost = `$${pricing.outputPer1M.toFixed(2)}/1M out`
  return `${inCost}, ${outCost}`
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Format model name for display: canonical name with alias if different.
 *
 * If the input was an alias, returns something like:
 *   "claude-sonnet-4-20250514 (sonnet)"
 * Otherwise, just the canonical name.
 */
export function renderModelName(model: string): string {
  const canonical = getCanonicalName(model)
  const trimmed = model.toLowerCase().trim()

  // If the input was an alias (resolved to something different), show both
  if (trimmed in MODEL_ALIASES && MODEL_ALIASES[trimmed] !== trimmed) {
    return `${canonical} (${trimmed})`
  }

  return canonical
}

/**
 * Check if a name is a known model alias.
 */
export function isModelAlias(name: string): boolean {
  return name.toLowerCase().trim() in MODEL_ALIASES
}

// ============================================================================
// Small/Fast Model Selection
// ============================================================================

/**
 * Return the cheapest/fastest model available.
 * Checks KITE_SMALL_FAST_MODEL env var first, then falls back to haiku.
 */
export function getSmallFastModel(): string {
  const envModel = process.env.KITE_SMALL_FAST_MODEL
  if (envModel && envModel.trim().length > 0) {
    return resolveModelAlias(envModel.trim())
  }
  return 'claude-3-5-haiku-20241022'
}

// ============================================================================
// Model Capabilities Detection
// ============================================================================

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
export function getModelCapabilities(model: string): ModelCapabilities {
  const canonical = getCanonicalName(model)
  const contextWindow = getContextWindowForModel(model)
  const maxOutput = getModelMaxOutputTokens(model)

  // Anthropic Claude models
  if (canonical.startsWith('claude-')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: true,
      supportsVision: true,
      supportsToolUse: true,
      supportsCaching: true,
    }
  }

  // OpenAI GPT models
  if (canonical.startsWith('gpt-')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: false,
      supportsVision: true,
      supportsToolUse: true,
      supportsCaching: false,
    }
  }

  // OpenAI o1/o1-mini reasoning models
  if (canonical.startsWith('o1')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: true,
      supportsVision: true,
      supportsToolUse: true,
      supportsCaching: false,
    }
  }

  // DeepSeek models
  if (canonical.startsWith('deepseek-')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: canonical.includes('reasoner'),
      supportsVision: false,
      supportsToolUse: true,
      supportsCaching: false,
    }
  }

  // Mistral models
  if (canonical.startsWith('mistral-')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: false,
      supportsVision: false,
      supportsToolUse: true,
      supportsCaching: false,
    }
  }

  // Google Gemini models
  if (canonical.startsWith('gemini-')) {
    return {
      contextWindow,
      maxOutput,
      supportsThinking: canonical.includes('2.5'),
      supportsVision: true,
      supportsToolUse: true,
      supportsCaching: false,
    }
  }

  // Unknown models — conservative defaults
  return {
    contextWindow,
    maxOutput,
    supportsThinking: false,
    supportsVision: false,
    supportsToolUse: true,
    supportsCaching: false,
  }
}
