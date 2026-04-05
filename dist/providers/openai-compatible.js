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
export class OpenAICompatibleProvider {
    name;
    apiUrl;
    apiKey;
    defaultModel;
    verifySsl;
    extraHeaders;
    extraPayload;
    constructor(options) {
        this.name = options.providerName;
        this.apiUrl = options.apiUrl;
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel;
        this.verifySsl = options.verifySsl ?? true;
        this.extraHeaders = options.extraHeaders ?? {};
        this.extraPayload = options.extraPayload ?? {};
    }
    async *chat(params) {
        const model = params.model || this.defaultModel;
        // Convert messages to OpenAI format
        const messages = this.convertMessages(params.messages, params.system);
        // Build request payload
        const payload = {
            model,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: params.maxTokens,
            ...this.extraPayload,
        };
        if (params.temperature !== undefined) {
            payload.temperature = params.temperature;
        }
        if (params.tools && params.tools.length > 0) {
            payload.tools = params.tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema,
                },
            }));
        }
        if (params.extra) {
            Object.assign(payload, params.extra);
        }
        // Build headers
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...this.extraHeaders,
        };
        // Disable SSL verification if needed
        if (!this.verifySsl) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }
        yield { type: 'message_start', model };
        let response;
        try {
            response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            yield { type: 'error', error, message: `Connection failed: ${error.message}`, retrying: false };
            return;
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            yield {
                type: 'error',
                error: new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`),
                message: `HTTP ${response.status}: ${body.slice(0, 200)}`,
                retrying: false,
            };
            return;
        }
        if (!response.body) {
            yield { type: 'error', error: new Error('No response body'), message: 'No response body', retrying: false };
            return;
        }
        // Parse SSE stream
        const toolCalls = new Map();
        let finishReason = '';
        let totalUsage = null;
        let accumulatedTextLength = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: '))
                        continue;
                    const chunk = line.slice(6).trim();
                    if (chunk === '[DONE]')
                        continue;
                    if (!chunk)
                        continue;
                    let evt;
                    try {
                        evt = JSON.parse(chunk);
                    }
                    catch {
                        continue;
                    }
                    const choices = evt.choices;
                    if (!choices || choices.length === 0)
                        continue;
                    for (const choice of choices) {
                        const delta = choice.delta;
                        if (!delta)
                            continue;
                        // Reasoning/thinking content (Gemma4, DeepSeek R1, etc.)
                        const reasoning = delta.reasoning;
                        if (reasoning) {
                            yield { type: 'thinking_delta', text: reasoning };
                        }
                        // Text content
                        const content = delta.content;
                        if (content) {
                            accumulatedTextLength += content.length;
                            yield { type: 'text_delta', text: content };
                        }
                        // Tool calls
                        const deltaToolCalls = delta.tool_calls;
                        if (deltaToolCalls) {
                            for (const tc of deltaToolCalls) {
                                const index = tc.index ?? 0;
                                if (!toolCalls.has(index)) {
                                    const id = tc.id ?? `tool_${index}`;
                                    const fn = tc.function;
                                    const name = fn?.name ?? '';
                                    toolCalls.set(index, { id, name, arguments: '' });
                                    if (name) {
                                        yield { type: 'tool_use_start', id, name };
                                    }
                                }
                                const fn = tc.function;
                                const args = fn?.arguments;
                                if (args) {
                                    const existing = toolCalls.get(index);
                                    existing.arguments += args;
                                    yield { type: 'tool_use_delta', id: existing.id, inputDelta: args };
                                }
                            }
                        }
                        // Finish reason
                        const fr = choice.finish_reason;
                        if (fr) {
                            finishReason = fr;
                        }
                    }
                    // Usage
                    const usage = evt.usage;
                    if (usage) {
                        totalUsage = {
                            inputTokens: usage.prompt_tokens ?? 0,
                            outputTokens: usage.completion_tokens ?? 0,
                            cacheReadInputTokens: 0,
                            cacheCreationInputTokens: 0,
                        };
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        // Emit tool_use_end events
        for (const [, tc] of toolCalls) {
            yield { type: 'tool_use_end', id: tc.id };
        }
        // Map finish reason
        const stopReason = finishReason === 'tool_calls' ? 'tool_use'
            : finishReason === 'length' ? 'max_tokens'
                : finishReason === 'stop' ? 'end_turn'
                    : 'end_turn';
        // If no usage from server, estimate from accumulated text
        if (!totalUsage) {
            const toolArgLen = Array.from(toolCalls.values()).reduce((s, tc) => s + tc.arguments.length, 0);
            totalUsage = {
                inputTokens: Math.ceil(JSON.stringify(messages).length / 4),
                outputTokens: Math.ceil((accumulatedTextLength + toolArgLen) / 4),
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
            };
        }
        yield { type: 'message_end', stopReason, usage: totalUsage };
    }
    supportsFeature(feature) {
        switch (feature) {
            case 'streaming': return true;
            case 'system_message': return true;
            case 'tool_use': return true;
            case 'vision': return true;
            case 'thinking': return false; // Provider-specific
            case 'structured_output': return false;
            case 'prompt_caching': return false;
            default: return false;
        }
    }
    // Convert UnifiedMessage[] to OpenAI format
    convertMessages(messages, systemPrompt) {
        const result = [];
        if (systemPrompt) {
            result.push({ role: 'system', content: systemPrompt });
        }
        for (const msg of messages) {
            if (msg.role === 'system') {
                const text = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
                result.push({ role: 'system', content: text });
                continue;
            }
            if (typeof msg.content === 'string') {
                result.push({ role: msg.role, content: msg.content });
                continue;
            }
            const blocks = msg.content;
            // Check for tool_use (assistant) or tool_result (user)
            const hasToolUse = blocks.some(b => b.type === 'tool_use');
            const hasToolResult = blocks.some(b => b.type === 'tool_result');
            if (hasToolUse) {
                // Assistant message with tool calls
                const textParts = [];
                const toolCallEntries = [];
                for (const b of blocks) {
                    if (b.type === 'text') {
                        textParts.push(b.text);
                    }
                    else if (b.type === 'tool_use') {
                        toolCallEntries.push({
                            id: b.id,
                            type: 'function',
                            function: { name: b.name, arguments: JSON.stringify(b.input) },
                        });
                    }
                }
                result.push({
                    role: 'assistant',
                    content: textParts.length > 0 ? textParts.join('\n') : null,
                    tool_calls: toolCallEntries,
                });
            }
            else if (hasToolResult) {
                // Tool result messages — each becomes a separate 'tool' role message
                for (const b of blocks) {
                    if (b.type === 'tool_result') {
                        const content = typeof b.content === 'string' ? b.content
                            : Array.isArray(b.content) ? b.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
                                : '';
                        result.push({
                            role: 'tool',
                            tool_call_id: b.tool_use_id,
                            content,
                        });
                    }
                }
            }
            else {
                // Plain text message
                const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
                if (text) {
                    result.push({ role: msg.role, content: text });
                }
            }
        }
        return result;
    }
}
// ============================================================================
// Factory functions for common providers
// ============================================================================
export function createOpenAIProvider(apiKey, model = 'gpt-4o') {
    return new OpenAICompatibleProvider({
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: apiKey ?? process.env.OPENAI_API_KEY ?? '',
        defaultModel: model,
        providerName: 'openai',
    });
}
export function createOllamaProvider(model = 'llama3.1', baseUrl = 'http://localhost:11434') {
    return new OpenAICompatibleProvider({
        apiUrl: `${baseUrl}/v1/chat/completions`,
        apiKey: 'ollama',
        defaultModel: model,
        providerName: 'ollama',
    });
}
export function createGroqProvider(apiKey, model = 'llama-3.1-70b-versatile') {
    return new OpenAICompatibleProvider({
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: apiKey ?? process.env.GROQ_API_KEY ?? '',
        defaultModel: model,
        providerName: 'groq',
    });
}
export function createDeepSeekProvider(apiKey, model = 'deepseek-chat') {
    return new OpenAICompatibleProvider({
        apiUrl: 'https://api.deepseek.com/chat/completions',
        apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY ?? '',
        defaultModel: model,
        providerName: 'deepseek',
    });
}
export function createMistralProvider(apiKey, model = 'mistral-large-latest') {
    return new OpenAICompatibleProvider({
        apiUrl: 'https://api.mistral.ai/v1/chat/completions',
        apiKey: apiKey ?? process.env.MISTRAL_API_KEY ?? '',
        defaultModel: model,
        providerName: 'mistral',
    });
}
export function createOpenRouterProvider(apiKey, model = 'anthropic/claude-sonnet-4-20250514') {
    return new OpenAICompatibleProvider({
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: apiKey ?? process.env.OPENROUTER_API_KEY ?? '',
        defaultModel: model,
        providerName: 'openrouter',
    });
}
//# sourceMappingURL=openai-compatible.js.map