/**
 * Readline-based REPL — works without Ink/React.
 *
 * This is the fallback REPL for non-TTY environments.
 * It provides the complete agent loop using the QueryEngine:
 *   user input → slash commands or QueryEngine → streaming display → repeat
 *
 * Key differences from Sprint 0 version:
 * - Uses QueryEngine (not raw provider.chat) for proper tool execution
 * - Sends tool schemas to LLM so it uses tool_use protocol (not text descriptions)
 * - Hides thinking text (only shows assistant text + tool results)
 * - Uses the command registry for slash commands
 * - Proper output formatting with clear separators
 */
import type { LLMProvider } from '../providers/types.js';
import type { KiteConfig } from '../utils/config.js';
export declare function createReadlineRepl(provider: LLMProvider, config: KiteConfig, initialPrompt: string | undefined, options: Record<string, unknown>): Promise<void>;
//# sourceMappingURL=readlineRepl.d.ts.map