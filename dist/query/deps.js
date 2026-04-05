/**
 * Query loop dependency injection interface.
 *
 * Implements the same DI pattern as Claude Code's query/deps.ts:
 * - All external dependencies are injectable for testing
 * - Default implementations provided for production
 * - QueryParams, QueryState, Terminal, Continue types
 */
import { randomUUID } from 'crypto';
// ============================================================================
// Default implementations
// ============================================================================
export function defaultCallModel(provider, request) {
    return provider.chat(request);
}
export function defaultMicroCompact(messages) {
    // Pass through — full implementation in microCompact.ts
    return messages;
}
export async function defaultAutoCompact(messages, _model, _provider) {
    return { messages, compacted: false, tokensFreed: 0 };
}
export function createDefaultDeps() {
    return {
        callModel: defaultCallModel,
        autoCompact: defaultAutoCompact,
        microCompact: defaultMicroCompact,
        uuid: randomUUID,
    };
}
//# sourceMappingURL=deps.js.map