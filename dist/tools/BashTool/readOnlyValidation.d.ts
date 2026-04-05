/**
 * Read-only command detection and flag validation.
 *
 * Determines whether a bash command is read-only (safe to auto-approve without
 * prompting the user). This includes:
 * - Flag-based validation for known commands (xargs, file, sort, grep, ps, git)
 * - Regex-based validation for simple read-only commands (cat, ls, find, etc.)
 * - Unquoted expansion detection (variable expansion, globs)
 * - Git subcommand read-only detection with per-subcommand flag allowlists
 *
 * The main entry point is checkReadOnlyConstraints(), which checks whether a
 * compound command (potentially with &&, ||, |, ;) consists entirely of
 * read-only subcommands.
 */
import type { PermissionResult } from '../../Tool.js';
import type { ToolPermissionContext } from '../../types/permissions.js';
export type FlagArgType = 'none' | 'number' | 'string' | 'char' | '{}' | 'EOF';
export interface ExternalCommandConfig {
    safeFlags: Record<string, FlagArgType>;
    additionalCommandIsDangerousCallback?: (rawCommand: string, args: string[]) => boolean;
    respectsDoubleDash?: boolean;
}
export declare const FLAG_PATTERN: RegExp;
/**
 * Validate that a value conforms to the expected argument type for a flag.
 */
export declare function validateFlagArgument(value: string, argType: FlagArgType): boolean;
/**
 * Core flag validation function. Walk through tokens starting at startIndex,
 * verifying that every flag is in the safe flags allowlist and that arguments
 * to flags are valid.
 *
 * Returns true if all tokens are safe; false if any token is disallowed.
 */
export declare function validateFlags(tokens: string[], startIndex: number, config: ExternalCommandConfig, options?: {
    isGit?: boolean;
    isGrepOrRg?: boolean;
}): boolean;
export declare const COMMAND_ALLOWLIST: Record<string, ExternalCommandConfig>;
export declare const GIT_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
/**
 * Track single-quote, double-quote, and escape state character by character
 * to detect dangerous unquoted expansions.
 *
 * Rejects:
 * - $ followed by [A-Za-z_@*#?!$0-9-] outside quotes (variable expansion)
 * - Glob characters [?*[\]] outside both single AND double quotes
 *
 * Returns true if dangerous expansion is found.
 */
export declare function containsUnquotedExpansion(command: string): boolean;
/**
 * Check whether a command is safe via flag parsing against the COMMAND_ALLOWLIST
 * and GIT_READ_ONLY_COMMANDS.
 *
 * Returns true if the command is recognized and all its flags are safe.
 */
export declare function isCommandSafeViaFlagParsing(command: string): boolean;
/**
 * Check whether a single command (not compound) is read-only.
 *
 * A command is read-only if:
 * 1. It passes unquoted expansion checks
 * 2. It matches a flag-based allowlist (COMMAND_ALLOWLIST or GIT_READ_ONLY_COMMANDS)
 * 3. OR it matches one of the READONLY_COMMAND_REGEXES patterns
 */
export declare function isCommandReadOnly(command: string): boolean;
/**
 * Check whether a command satisfies read-only constraints.
 *
 * This is the main exported function used by the permission system.
 *
 * - First runs bashCommandIsSafe security checks. If it returns 'ask', propagate.
 * - Splits the command into subcommands (handling &&, ||, |, ;).
 * - Checks each subcommand is read-only via isCommandReadOnly.
 * - If ALL subcommands are read-only, returns allow.
 * - Otherwise returns passthrough so downstream permission checks can decide.
 */
export declare function checkReadOnlyConstraints(input: {
    command: string;
}, toolPermissionContext: ToolPermissionContext): PermissionResult;
//# sourceMappingURL=readOnlyValidation.d.ts.map