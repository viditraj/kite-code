/**
 * Generic OpenAI-compatible provider using native Node.js fetch.
 *
 * Works with any endpoint that implements the OpenAI Chat Completions API:
 * - OpenAI (api.openai.com)
 * - Ollama (localhost:11434)
 * - Groq (api.groq.com)
 * - DeepSeek (api.deepseek.com)
 * - Mistral (api.mistral.ai)
 * - OpenRouter (openrouter.ai)
 * - Custom endpoints (e.g., Dell Gemma4)
 *
 * Supports:
 * - Streaming SSE responses
 * - Tool/function calling
 * - Reasoning/thinking content (reasoning field in delta)
 * - Self-signed certificates (NODE_TLS_REJECT_UNAUTHORIZED=0)
 * - Custom headers and payload fields
 */
import type { ChatRequest, LLMProvider, ProviderFeature, StreamEvent } from './types.js';
export interface OpenAIProviderOptions {
    /** Full URL to the chat completions endpoint */
    apiUrl: string;
    /** API key (sent as Bearer token) */
    apiKey: string;
    /** Default model name */
    defaultModel: string;
    /** Provider display name */
    providerName: string;
    /** Whether to verify SSL (default: true) */
    verifySsl?: boolean;
    /** Extra headers to send with every request */
    extraHeaders?: Record<string, string>;
    /** Extra fields to merge into every request payload */
    extraPayload?: Record<string, unknown>;
}
export declare class OpenAICompatibleProvider implements LLMProvider {
    readonly name: string;
    private apiUrl;
    private apiKey;
    private defaultModel;
    private verifySsl;
    private extraHeaders;
    private extraPayload;
    constructor(options: OpenAIProviderOptions);
    chat(params: ChatRequest): AsyncGenerator<StreamEvent, void, undefined>;
    supportsFeature(feature: ProviderFeature): boolean;
    private convertMessages;
}
export declare function createOpenAIProvider(apiKey?: string, model?: string): OpenAICompatibleProvider;
export declare function createOllamaProvider(model?: string, baseUrl?: string): OpenAICompatibleProvider;
export declare function createGroqProvider(apiKey?: string, model?: string): OpenAICompatibleProvider;
export declare function createDeepSeekProvider(apiKey?: string, model?: string): OpenAICompatibleProvider;
export declare function createMistralProvider(apiKey?: string, model?: string): OpenAICompatibleProvider;
export declare function createOpenRouterProvider(apiKey?: string, model?: string): OpenAICompatibleProvider;
//# sourceMappingURL=openai-compatible.d.ts.map