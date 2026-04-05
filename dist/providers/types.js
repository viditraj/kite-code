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
export function emptyUsage() {
    return {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
    };
}
export function addUsage(a, b) {
    return {
        inputTokens: a.inputTokens + (b.inputTokens ?? 0),
        outputTokens: a.outputTokens + (b.outputTokens ?? 0),
        cacheReadInputTokens: a.cacheReadInputTokens + (b.cacheReadInputTokens ?? 0),
        cacheCreationInputTokens: a.cacheCreationInputTokens + (b.cacheCreationInputTokens ?? 0),
    };
}
//# sourceMappingURL=types.js.map