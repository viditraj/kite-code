/**
 * Permission type definitions.
 *
 * Implements the same types as Claude Code's src/types/permissions.ts.
 * Pure type definitions with no runtime dependencies.
 */
// ============================================================================
// Permission Modes
// ============================================================================
export const PERMISSION_MODES = [
    'acceptEdits',
    'bypassPermissions',
    'default',
    'dontAsk',
    'plan',
];
export const PERMISSION_RULE_SOURCES = [
    'userSettings',
    'projectSettings',
    'localSettings',
    'flagSettings',
    'policySettings',
    'cliArg',
    'command',
    'session',
];
export function createEmptyToolPermissionContext() {
    return {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
    };
}
//# sourceMappingURL=permissions.js.map