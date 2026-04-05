/**
 * Main bash permission engine.
 *
 * Orchestrates all bash security layers:
 * 1. Rule matching (deny/ask/allow with env-var stripping)
 * 2. Security validators (23 checks from bashSecurity.ts)
 * 3. Path constraints (pathValidation.ts)
 * 4. Read-only detection (readOnlyValidation.ts)
 * 5. Sed constraints (sedValidation.ts)
 * 6. Mode validation (modeValidation.ts)
 *
 * Implements the same logic as Claude Code's bashPermissions.ts:
 * - SAFE_BASH_ENV_VARS for env-var stripping in rule matching
 * - Wrapper command stripping (timeout, time, nice, nohup, stdbuf)
 * - Compound command handling (prefix rules don't match compounds)
 * - Suggestion generation for permission prompts
 */
import type { PermissionResult } from '../../Tool.js';
import type { ToolPermissionContext } from '../../types/permissions.js';
/**
 * Strip leading safe env vars from a command.
 * Only strips vars in SAFE_BASH_ENV_VARS.
 * Used for allow rule matching.
 */
export declare function stripSafeEnvVars(command: string): string;
/**
 * Aggressively strip ALL leading env vars.
 * Used for deny/ask rule matching (prevents bypass via FOO=bar denied_cmd).
 */
export declare function stripAllLeadingEnvVars(command: string): string;
/**
 * Strip wrapper commands (timeout, time, nice, nohup, stdbuf)
 * and leading safe env vars for permission matching.
 */
export declare function stripSafeWrappers(command: string): string;
/**
 * Strip output redirections from a command for rule matching.
 */
export declare function stripOutputRedirections(command: string): string;
/**
 * Extract a stable 2-word command prefix for reusable rules.
 * Skips leading safe env var assignments.
 * Returns null if not a safe prefix.
 */
export declare function getSimpleCommandPrefix(command: string): string | null;
/**
 * Main bash tool permission check.
 *
 * Priority order:
 * 1. Exact/prefix/wildcard deny rules → DENY
 * 2. Exact/prefix/wildcard ask rules → ASK
 * 3. Security validators (bashCommandIsSafe)
 * 4. Path constraints
 * 5. Sed constraints
 * 6. Mode validation
 * 7. Read-only detection → ALLOW
 * 8. Exact/prefix/wildcard allow rules → ALLOW
 * 9. Passthrough → ASK (with suggestions)
 */
export declare function bashToolCheckPermission(command: string, toolPermissionContext: ToolPermissionContext): PermissionResult;
/**
 * Check permission for a bash command, handling compound commands.
 *
 * For compound commands (&&, ||, ;), each subcommand is checked individually.
 */
export declare function bashToolHasPermission(command: string, toolPermissionContext: ToolPermissionContext): PermissionResult;
//# sourceMappingURL=bashPermissions.d.ts.map