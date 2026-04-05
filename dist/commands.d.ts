/**
 * Command registry — loads, registers, and resolves slash commands.
 *
 * Implements the same patterns as Claude Code's commands.ts:
 * - Built-in commands (help, clear, compact, cost, model, mode, exit, etc.)
 * - Skill-based commands (from .kite/skills/ directories)
 * - MCP prompt commands (from connected MCP servers)
 * - Command resolution by name or alias
 * - Availability filtering and isEnabled checks
 * - Cache management for dynamic command sources
 */
import type { Command, LocalCommandResult, LocalCommandContext } from './types/command.js';
export type { Command, CommandBase, LocalCommandResult, LocalCommandContext, CommandResultDisplay, LocalCommandOnDone, PromptCommand, LocalCommand, LocalJSXCommand, } from './types/command.js';
export { getCommandName, isCommandEnabled } from './types/command.js';
/**
 * Get all available commands (built-in + skills + MCP).
 * Memoized for performance.
 */
export declare function getCommands(): Command[];
/**
 * Clear the command cache (call when commands change dynamically).
 */
export declare function clearCommandsCache(): void;
/**
 * Add a command to the registry dynamically.
 */
export declare function registerCommand(command: Command): void;
/**
 * Find a command by name or alias.
 */
export declare function findCommand(nameOrAlias: string): Command | undefined;
/**
 * Get command names for autocomplete.
 */
export declare function getCommandNames(): string[];
/**
 * Get built-in command names set.
 */
export declare function builtInCommandNames(): Set<string>;
/**
 * Execute a command by name.
 */
export declare function executeCommand(nameOrAlias: string, args: string, context: LocalCommandContext): Promise<LocalCommandResult | null>;
//# sourceMappingURL=commands.d.ts.map