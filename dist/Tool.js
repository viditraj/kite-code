/**
 * Core Tool interface and buildTool factory.
 *
 * Implements the same patterns as Claude Code's Tool.ts:
 * - Tool type with all methods and properties
 * - buildTool() factory with fail-closed TOOL_DEFAULTS
 * - ToolDef type for partial definitions
 * - Zod-based input schemas
 *
 * Key design: buildTool() spreads TOOL_DEFAULTS first, then the definition.
 * This ensures fail-closed behavior: isConcurrencySafe defaults to false,
 * isReadOnly defaults to false, etc.
 */
// ============================================================================
// TOOL_DEFAULTS — fail-closed
// ============================================================================
const TOOL_DEFAULTS = {
    isEnabled: () => true,
    isConcurrencySafe: (_input) => false,
    isReadOnly: (_input) => false,
    isDestructive: (_input) => false,
    checkPermissions: (input, _ctx) => Promise.resolve({ behavior: 'passthrough', message: '', updatedInput: input }),
    toAutoClassifierInput: (_input) => '',
    userFacingName: (_input) => '',
};
// ============================================================================
// buildTool — factory that merges defaults
// ============================================================================
/**
 * Build a complete Tool from a partial definition, filling in safe defaults.
 *
 * Defaults (fail-closed where it matters):
 * - isEnabled → true
 * - isConcurrencySafe → false (assume not safe)
 * - isReadOnly → false (assume writes)
 * - isDestructive → false
 * - checkPermissions → passthrough (defer to general permission system)
 * - toAutoClassifierInput → '' (skip classifier)
 * - userFacingName → name
 */
export function buildTool(def) {
    return {
        ...TOOL_DEFAULTS,
        userFacingName: () => def.name,
        ...def,
    };
}
// ============================================================================
// Utility functions
// ============================================================================
/** Check if a tool matches the given name (primary name or alias) */
export function toolMatchesName(tool, name) {
    return tool.name === name || (tool.aliases?.includes(name) ?? false);
}
/** Find a tool by name or alias from a list of tools */
export function findToolByName(tools, name) {
    return tools.find(t => toolMatchesName(t, name));
}
//# sourceMappingURL=Tool.js.map