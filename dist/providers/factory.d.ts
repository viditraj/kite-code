/**
 * Provider factory — resolves config to a concrete LLM provider.
 *
 * Zero dependency on any provider SDK. All providers use raw fetch.
 */
import type { KiteConfig } from '../utils/config.js';
import type { LLMProvider } from './types.js';
/**
 * Create an LLM provider from the Kite config.
 *
 * All providers use raw fetch — zero SDK dependencies.
 */
export declare function createProvider(config: KiteConfig): LLMProvider;
//# sourceMappingURL=factory.d.ts.map