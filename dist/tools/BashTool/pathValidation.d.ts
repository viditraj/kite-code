/**
 * Path extraction and validation for bash commands.
 *
 * Extracts file paths from known commands (cd, ls, grep, sed, etc.) and
 * validates them against the allowed working directories. Also detects
 * dangerous removal targets (system directories) that should never be
 * auto-allowed.
 *
 * Design:
 * - PATH_EXTRACTORS: maps each known command to a function that extracts
 *   the file-path arguments from the tokenized args.
 * - COMMAND_OPERATION_TYPE: classifies each command as read / write / create.
 * - validateCommandPaths: main per-command validator.
 * - checkPathConstraints: top-level entry point called from the permission chain.
 */
import type { PermissionResult } from '../../Tool.js';
import type { ToolPermissionContext } from '../../types/permissions.js';
export type FileOperationType = 'read' | 'write' | 'create';
export type PathCommand = 'cd' | 'ls' | 'find' | 'mkdir' | 'touch' | 'rm' | 'rmdir' | 'mv' | 'cp' | 'cat' | 'head' | 'tail' | 'sort' | 'uniq' | 'wc' | 'cut' | 'paste' | 'column' | 'tr' | 'file' | 'stat' | 'diff' | 'awk' | 'strings' | 'hexdump' | 'od' | 'base64' | 'nl' | 'grep' | 'rg' | 'sed' | 'git' | 'jq' | 'sha256sum' | 'sha1sum' | 'md5sum';
/**
 * Filter flag arguments from an args array.
 *
 * Handles the `--` (end-of-options) marker: everything after `--` is treated
 * as a positional argument even if it starts with `-`.
 *
 * @param args - Tokenized argument list (command name already removed)
 * @returns Non-flag positional arguments
 */
export declare function filterOutFlags(args: string[]): string[];
/**
 * Parse paths from grep/rg style commands.
 *
 * The first non-flag argument is the pattern (skip it), the rest are file
 * paths. If no paths are found and hasRecursiveFlag is true, return `['.']`
 * (search current directory).
 *
 * @param args - Tokenized argument list (command name already removed)
 * @param hasRecursiveFlag - Whether `-r`, `-R`, or `--recursive` was present
 * @returns Array of file paths
 */
export declare function parsePatternCommand(args: string[], hasRecursiveFlag: boolean): string[];
/**
 * Map from each recognized PathCommand to a function that extracts file-path
 * arguments from the tokenized args array (command name already removed).
 */
export declare const PATH_EXTRACTORS: Record<PathCommand, (args: string[]) => string[]>;
/**
 * Map each known command to its file operation type.
 *
 * - read: command only reads files/directories
 * - create: command creates new files/directories
 * - write: command modifies or deletes files
 */
export declare const COMMAND_OPERATION_TYPE: Record<PathCommand, FileOperationType>;
/**
 * System directories that rm/rmdir should NEVER auto-allow removal of.
 * These are critical system paths whose removal could brick the system.
 */
export declare const DANGEROUS_REMOVAL_PATHS: Set<string>;
/**
 * Check if an absolute path is dangerous to remove.
 *
 * A path is dangerous if:
 * - It is in the DANGEROUS_REMOVAL_PATHS set, OR
 * - It is a 1-level child of `/` (like `/opt`, `/srv`, `/mnt`)
 *
 * @param absolutePath - The absolute path to check (must be already resolved)
 * @returns true if the path should never be auto-allowed for removal
 */
export declare function isDangerousRemovalPath(absolutePath: string): boolean;
/**
 * For rm/rmdir commands, check if any target paths are dangerous system directories.
 *
 * Extracts paths from the command args, expands tildes, resolves to absolute,
 * and checks each against isDangerousRemovalPath.
 *
 * @param command - The PathCommand (should be 'rm' or 'rmdir')
 * @param args - Tokenized arguments (command name already removed)
 * @param cwd - Current working directory for resolving relative paths
 * @returns 'ask' if a dangerous path is found, 'passthrough' otherwise
 */
export declare function checkDangerousRemovalPaths(command: PathCommand, args: string[], cwd: string): PermissionResult;
/**
 * Replace a leading `~/` or standalone `~` with the user's home directory.
 *
 * @param p - A file path that may begin with `~`
 * @returns The expanded path
 */
export declare function expandTilde(p: string): string;
/**
 * Validate that all file paths referenced by a command are within the
 * allowed working directories.
 *
 * @param command - The recognized PathCommand
 * @param args - Tokenized arguments (command name already removed)
 * @param cwd - Current working directory
 * @param workingDirectories - List of allowed working directories
 * @param operationTypeOverride - Override the default operation type for the command
 * @returns 'passthrough' if all paths are valid, 'ask' with details otherwise
 */
export declare function validateCommandPaths(command: PathCommand, args: string[], cwd: string, workingDirectories: string[], operationTypeOverride?: FileOperationType): PermissionResult;
/**
 * Simple shell-like tokenizer: splits a string on whitespace while respecting
 * single and double quotes. Does NOT handle backslash escaping outside quotes
 * (that level of fidelity is handled by the security validators).
 *
 * @param str - The string to tokenize
 * @returns Array of tokens
 */
declare function tokenizeArgs(str: string): string[];
/**
 * Extract the base command name from a subcommand string.
 *
 * Handles:
 * - Leading environment variables (KEY=VALUE cmd)
 * - Common path prefixes (/usr/bin/cmd → cmd)
 * - sudo / env / nohup prefixes
 *
 * @param subcommand - A single (sub)command string
 * @returns The base command name
 */
declare function extractBaseCommand(subcommand: string): string;
/**
 * Extract file paths that are targets of output redirections (> and >>).
 *
 * Scans through the command text character by character, respecting quotes,
 * and collects the target of each `>` or `>>` operator.
 *
 * @param command - The full command string
 * @returns Array of output redirection target paths
 */
declare function extractRedirectionTargets(command: string): string[];
/**
 * Type guard: check if a string is a known PathCommand.
 */
declare function isPathCommand(cmd: string): cmd is PathCommand;
/**
 * Main entry point: validate all file paths referenced by a bash command.
 *
 * Splits the command into subcommands (by shell operators), extracts the
 * base command of each, and validates paths using the appropriate extractor.
 *
 * Also validates output redirection targets (>, >>).
 *
 * @param input - Object containing the command string
 * @param cwd - Current working directory
 * @param workingDirectories - List of allowed working directories
 * @param toolPermissionContext - Permission context (unused currently, reserved)
 * @returns 'passthrough' if all paths are valid, 'ask' if any path is blocked
 */
export declare function checkPathConstraints(input: {
    command: string;
}, cwd: string, workingDirectories: string[], toolPermissionContext: ToolPermissionContext): PermissionResult;
export { tokenizeArgs as _tokenizeArgs, extractBaseCommand as _extractBaseCommand, extractRedirectionTargets as _extractRedirectionTargets, isPathCommand as _isPathCommand, };
//# sourceMappingURL=pathValidation.d.ts.map