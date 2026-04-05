/**
 * Core permission engine.
 *
 * Implements the same evaluation chain as Claude Code's permissions.ts:
 * - getAllowRules, getDenyRules, getAskRules
 * - toolMatchesRule (whole-tool + MCP server-level matching)
 * - hasPermissionsToUseToolInner (steps 1a-1g, 2a-2b, 3)
 * - createPermissionRequestMessage
 *
 * Evaluation order (matching Claude Code exactly):
 *   1a. Entire tool denied by rule → DENY
 *   1b. Entire tool has ask rule → ASK
 *   1c. Tool.checkPermissions() for content-specific rules
 *   1d. Tool denied → DENY
 *   1e. Tool requires user interaction → ASK
 *   1f. Content-specific ask rules → ASK (bypass-immune)
 *   1g. Safety checks → ASK (bypass-immune)
 *   2a. Bypass/plan mode → ALLOW
 *   2b. Tool-wide allow rule → ALLOW
 *   3.  Passthrough → ASK
 */
import type { PermissionRule, PermissionDecision, PermissionResult, PermissionDecisionReason, ToolPermissionContext, PermissionBehavior } from '../../types/permissions.js';
export declare function getAllowRules(context: ToolPermissionContext): PermissionRule[];
export declare function getDenyRules(context: ToolPermissionContext): PermissionRule[];
export declare function getAskRules(context: ToolPermissionContext): PermissionRule[];
export declare function getDenyRuleForTool(context: ToolPermissionContext, toolName: string, mcpInfo?: {
    serverName: string;
    toolName: string;
}): PermissionRule | null;
export declare function getAskRuleForTool(context: ToolPermissionContext, toolName: string, mcpInfo?: {
    serverName: string;
    toolName: string;
}): PermissionRule | null;
export declare function getAllowRuleForTool(context: ToolPermissionContext, toolName: string, mcpInfo?: {
    serverName: string;
    toolName: string;
}): PermissionRule | null;
/**
 * Get content-specific rules for a tool.
 * Returns a map of rule content → PermissionRule.
 */
export declare function getRuleByContentsForTool(context: ToolPermissionContext, toolName: string, behavior: PermissionBehavior): Map<string, PermissionRule>;
export declare function createPermissionRequestMessage(toolName: string, decisionReason?: PermissionDecisionReason): string;
interface ToolForPermissionCheck {
    name: string;
    mcpInfo?: {
        serverName: string;
        toolName: string;
    };
    inputSchema: {
        parse: (input: unknown) => unknown;
        safeParse: (input: unknown) => {
            success: boolean;
            data?: unknown;
        };
    };
    checkPermissions: (input: unknown, context: unknown) => Promise<PermissionResult>;
    requiresUserInteraction?: () => boolean;
}
/**
 * Main permission check — implements hasPermissionsToUseToolInner.
 *
 * Steps 1a-1g, 2a-2b, 3 from Claude Code's permissions.ts.
 */
export declare function hasPermissionsToUseToolInner(tool: ToolForPermissionCheck, input: Record<string, unknown>, permContext: ToolPermissionContext, toolUseContext?: unknown): Promise<PermissionDecision>;
/**
 * Outer wrapper — applies dontAsk and shouldAvoidPermissionPrompts.
 */
export declare function hasPermissionsToUseTool(tool: ToolForPermissionCheck, input: Record<string, unknown>, permContext: ToolPermissionContext, toolUseContext?: unknown): Promise<PermissionDecision>;
export {};
//# sourceMappingURL=permissions.d.ts.map