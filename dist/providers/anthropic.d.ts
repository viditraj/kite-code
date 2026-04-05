/**
 * Anthropic Messages API provider using raw fetch (no SDK dependency).
 *
 * Speaks Anthropic's native Messages API format directly via HTTP.
 * Zero dependency on @anthropic-ai/sdk.
 *
 * API docs: https://docs.anthropic.com/en/api/messages
 */
import type { ChatRequest, LLMProvider, ProviderFeature, StreamEvent } from './types.js';
export interface AnthropicProviderOptions {
    apiKey: string;
    model?: string;
    apiBaseUrl?: string;
}
export declare class AnthropicProvider implements LLMProvider {
    readonly name = "anthropic";
    private apiKey;
    private defaultModel;
    private apiBaseUrl;
    constructor(options: AnthropicProviderOptions);
    chat(params: ChatRequest): AsyncGenerator<StreamEvent, void, undefined>;
    supportsFeature(feature: ProviderFeature): boolean;
    private convertMessages;
}
//# sourceMappingURL=anthropic.d.ts.map