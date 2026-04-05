/**
 * Universal LLM Provider interface.
 *
 * This is the critical abstraction that replaces all @anthropic-ai/sdk imports.
 * Every tool, the query loop, and the UI interact with LLMs exclusively through
 * this interface. Provider-specific SDKs are only used inside adapter implementations.
 *
 * Design matches Claude Code's implicit provider interface extracted from
 * src/services/api/claude.ts, but made explicit and provider-agnostic.
 */
export type StreamEvent = {
    type: 'message_start';
    model: string;
    usage?: TokenUsage;
} | {
    type: 'text_delta';
    text: string;
} | {
    type: 'thinking_delta';
    text: string;
} | {
    type: 'tool_use_start';
    id: string;
    name: string;
} | {
    type: 'tool_use_delta';
    id: string;
    inputDelta: string;
} | {
    type: 'tool_use_end';
    id: string;
} | {
    type: 'message_end';
    stopReason: StopReason;
    usage?: TokenUsage;
} | {
    type: 'error';
    error: Error;
    message: string;
    retrying: boolean;
} | {
    type: 'status';
    message: string;
};
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
}
export declare function emptyUsage(): TokenUsage;
export declare function addUsage(a: TokenUsage, b: Partial<TokenUsage>): TokenUsage;
export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string | ContentBlock[];
    is_error?: boolean;
} | {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
} | {
    type: 'thinking';
    thinking: string;
};
export interface UnifiedMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentBlock[];
}
export interface ToolSchema {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
    };
}
export interface ChatRequest {
    model: string;
    messages: UnifiedMessage[];
    system?: string;
    tools?: ToolSchema[];
    maxTokens: number;
    temperature?: number;
    stream: true;
    /** Provider-specific extras merged into the request */
    extra?: Record<string, unknown>;
}
export type ProviderFeature = 'tool_use' | 'streaming' | 'vision' | 'thinking' | 'structured_output' | 'prompt_caching' | 'system_message';
/**
 * Universal LLM provider interface.
 *
 * All providers (Anthropic, OpenAI, Ollama, etc.) implement this interface.
 * The query loop and tools interact with the LLM exclusively through this.
 */
export interface LLMProvider {
    /** Provider name (e.g., 'anthropic', 'openai', 'ollama') */
    readonly name: string;
    /**
     * Send a chat request and stream back normalized events.
     *
     * This is the core method. Implementations must:
     * 1. Convert ChatRequest to provider-specific format
     * 2. Make the streaming API call
     * 3. Yield normalized StreamEvent objects
     * 4. Handle errors and yield error events
     */
    chat(params: ChatRequest): AsyncGenerator<StreamEvent, void, undefined>;
    /** Check if this provider supports a specific feature */
    supportsFeature(feature: ProviderFeature): boolean;
}
//# sourceMappingURL=types.d.ts.map