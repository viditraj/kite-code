/**
 * Provider factory — resolves config to a concrete LLM provider.
 *
 * Zero dependency on any provider SDK. All providers use raw fetch.
 */
import { getApiKey } from '../utils/config.js';
import { OpenAICompatibleProvider, createOpenAIProvider, createOllamaProvider, createGroqProvider, createDeepSeekProvider, createMistralProvider, createOpenRouterProvider, } from './openai-compatible.js';
import { AnthropicProvider } from './anthropic.js';
/**
 * Create an LLM provider from the Kite config.
 *
 * All providers use raw fetch — zero SDK dependencies.
 */
export function createProvider(config) {
    const name = config.provider.name.toLowerCase();
    const apiKey = getApiKey(config) ?? '';
    const model = config.provider.model;
    const baseUrl = config.provider.apiBaseUrl;
    // If apiBaseUrl is a full chat completions URL, use OpenAI-compatible
    if (baseUrl && baseUrl.includes('/chat/completions')) {
        return new OpenAICompatibleProvider({
            apiUrl: baseUrl,
            apiKey: apiKey || 'no-key',
            defaultModel: model,
            providerName: name || 'custom',
            // Default to verifySsl=false for custom endpoints (self-signed certs are common)
            verifySsl: config.provider.verifySsl ?? false,
            extraHeaders: config.provider.extraHeaders,
            extraPayload: config.provider.extraPayload,
        });
    }
    // If apiBaseUrl is a base URL, append the appropriate path
    if (baseUrl) {
        const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        return new OpenAICompatibleProvider({
            apiUrl: url + 'chat/completions',
            apiKey: apiKey || 'no-key',
            defaultModel: model,
            providerName: name || 'custom',
            verifySsl: config.provider.verifySsl ?? false,
            extraHeaders: config.provider.extraHeaders,
            extraPayload: config.provider.extraPayload,
        });
    }
    // Named provider resolution — all using raw fetch, zero SDK dependencies
    switch (name) {
        case 'anthropic':
            return new AnthropicProvider({ apiKey, model });
        case 'openai':
            return createOpenAIProvider(apiKey, model);
        case 'ollama':
            return createOllamaProvider(model);
        case 'groq':
            return createGroqProvider(apiKey, model);
        case 'deepseek':
            return createDeepSeekProvider(apiKey, model);
        case 'mistral':
            return createMistralProvider(apiKey, model);
        case 'openrouter':
            return createOpenRouterProvider(apiKey, model);
        default:
            // Unknown provider — try as OpenAI-compatible
            return new OpenAICompatibleProvider({
                apiUrl: `https://api.${name}.com/v1/chat/completions`,
                apiKey,
                defaultModel: model,
                providerName: name,
            });
    }
}
//# sourceMappingURL=factory.js.map