/**
 * Sed-specific security validation for bash commands.
 *
 * Implements the same logic as Claude Code's sed validation:
 * - Allowlist-based approach: only known-safe sed patterns pass through
 * - Print commands (read-only) are always safe
 * - Substitution commands are safe when they don't use dangerous features
 * - Dangerous operations (write, execute, shell escape) are blocked
 *
 * Design: fail-closed. Unknown constructs → ask user for permission.
 */
import type { PermissionResult } from '../../Tool.js';
import type { ToolPermissionContext } from '../../types/permissions.js';
/**
 * Check if a sed expression is a simple print command.
 *
 * Matches: `p`, `1p`, `123p`, `1,5p`
 * These are read-only operations that just output lines.
 */
export declare function isPrintCommand(cmd: string): boolean;
/**
 * Check if a sed command is a safe line-printing command.
 *
 * Requirements:
 * - Must have the `-n` flag (suppress default output)
 * - All flags must be in the allowed set
 * - All expressions must be print commands (possibly semicolon-separated)
 */
export declare function isLinePrintingCommand(command: string, expressions: string[]): boolean;
/**
 * Check if a sed command is a safe substitution command.
 *
 * Requirements:
 * - Exactly one expression
 * - Expression starts with 's'
 * - Valid delimiter and proper s/pattern/replacement/flags structure
 * - Only safe flags (g, p, i, I, m, M, one digit)
 * - Command-level flags must be in allowed set
 * - If allowFileWrites, -i/--in-place is additionally allowed
 */
export declare function isSubstitutionCommand(command: string, expressions: string[], hasFileArguments: boolean, options?: {
    allowFileWrites?: boolean;
}): boolean;
/**
 * Extract sed expressions from a command string.
 *
 * Handles:
 * - `-e expr` and `--expression expr` flags
 * - `--expression=expr` format
 * - `-e=value` format
 * - Inline expressions (first non-flag argument)
 * - Rejects dangerous flag combinations (-ew, -eW, -ee, -we)
 */
export declare function extractSedExpressions(command: string): string[];
/**
 * Check if a sed command has file arguments (files to process).
 *
 * Parses command tokens, skips flags and expressions,
 * then checks if there are remaining non-flag arguments.
 */
export declare function hasFileArgs(command: string): boolean;
/**
 * Check if any sed expression contains dangerous operations.
 *
 * This is the core security check. It inspects expressions for:
 * - Non-ASCII characters (unicode obfuscation)
 * - Curly braces (grouped commands)
 * - Newlines (multi-line tricks)
 * - Comments (code hiding)
 * - Negation (! address modifier)
 * - GNU step addressing (~)
 * - Comma edge cases
 * - Backslash obfuscation
 * - Write (w/W) commands
 * - Execute (e/E) commands
 * - Substitution flags with w/W/e/E
 * - Transliterate (y) with w/W/e/E
 */
export declare function containsDangerousOperations(expressions: string[]): boolean;
/**
 * Check if a sed command is allowed by the safety allowlist.
 *
 * A command is allowed if:
 * 1. It doesn't contain dangerous operations
 * 2. It's either a line-printing command OR a safe substitution command
 */
export declare function sedCommandIsAllowedByAllowlist(command: string, options?: {
    allowFileWrites?: boolean;
}): boolean;
/**
 * Main entry point: check sed command security constraints.
 *
 * - Splits compound commands on &&, ||, ;, |
 * - Checks each sed subcommand against the allowlist
 * - In acceptEdits mode, allows -i (in-place editing) flag
 * - Returns 'passthrough' for safe commands, 'ask' for dangerous ones
 */
export declare function checkSedConstraints(input: {
    command: string;
}, toolPermissionContext: ToolPermissionContext): PermissionResult;
//# sourceMappingURL=sedValidation.d.ts.map