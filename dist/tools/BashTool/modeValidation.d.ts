/**
 * Permission mode validation for bash commands.
 *
 * In acceptEdits mode, certain filesystem-modifying commands (mkdir, touch, rm, etc.)
 * are automatically allowed without prompting the user. This module implements
 * the logic to detect those commands and produce the appropriate PermissionResult.
 */
import type { PermissionResult } from '../../Tool.js';
import type { ToolPermissionContext } from '../../types/permissions.js';
declare const ACCEPT_EDITS_ALLOWED_COMMANDS: readonly ["mkdir", "touch", "rm", "rmdir", "mv", "cp", "sed"];
/**
 * Main entry point: check whether the full command (potentially compound)
 * can be auto-allowed based on the current permission mode.
 *
 * - bypassPermissions and dontAsk modes are handled elsewhere, so we return
 *   passthrough immediately for those.
 * - The command is split on `&&`, `||`, and `;` into subcommands.
 * - If ANY subcommand is auto-allowed, we return that allow result.
 * - Otherwise we return passthrough so downstream checks can decide.
 */
declare function checkPermissionMode(input: {
    command: string;
}, toolPermissionContext: ToolPermissionContext): PermissionResult;
/**
 * Return the list of commands that are automatically allowed in the given mode.
 */
declare function getAutoAllowedCommands(mode: ToolPermissionContext['mode']): readonly string[];
export { checkPermissionMode, getAutoAllowedCommands, ACCEPT_EDITS_ALLOWED_COMMANDS };
//# sourceMappingURL=modeValidation.d.ts.map