/**
 * Command autocomplete — generate suggestions when user types '/'.
 *
 * Adapted from Claude Code's commandSuggestions.ts for Kite.
 * Provides fuzzy matching of command names, aliases, and descriptions.
 */
export interface CommandSuggestion {
    /** Command name (e.g., 'help', 'model') */
    name: string;
    /** Display text with / prefix (e.g., '/help') */
    displayText: string;
    /** Command description */
    description: string;
    /** Optional argument hint */
    argumentHint?: string;
    /** Aliases for this command */
    aliases?: string[];
    /** Match score (0-1, higher is better) */
    score: number;
}
export type SuggestionType = 'command' | 'file' | 'none';
/**
 * Generate command suggestions for a given query string.
 *
 * @param query - The text after '/' (may be empty for all commands)
 * @param maxResults - Maximum number of suggestions to return (default 15)
 * @returns Array of CommandSuggestion sorted by score descending
 */
export declare function generateCommandSuggestions(query: string, maxResults?: number): CommandSuggestion[];
/**
 * Find the best matching command for ghost text (inline completion).
 *
 * @param query - The text after '/'
 * @returns The best-matching command name suffix, or null
 */
export declare function getBestCommandMatch(query: string): string | null;
/**
 * Detect a slash command in the input text.
 * Returns the command prefix (without /) if found at the start of the input.
 */
export declare function findSlashCommandPrefix(input: string): string | null;
//# sourceMappingURL=commandSuggestions.d.ts.map