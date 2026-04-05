/**
 * Command type definitions.
 *
 * Implements the same type system as Claude Code's types/command.ts:
 * - CommandBase: common fields (name, description, aliases, isEnabled, isHidden)
 * - PromptCommand: injects text into conversation (skills, MCP prompts)
 * - LocalCommand: executes locally, returns text result
 * - LocalJSXCommand: renders JSX UI (model picker, config editor, etc.)
 * - Command: discriminated union of all three
 */
// ============================================================================
// Helpers
// ============================================================================
/** Resolves the user-visible name, falling back to cmd.name. */
export function getCommandName(cmd) {
    return cmd.userFacingName?.() ?? cmd.name;
}
/** Resolves whether the command is enabled, defaulting to true. */
export function isCommandEnabled(cmd) {
    return cmd.isEnabled?.() ?? true;
}
//# sourceMappingURL=command.js.map