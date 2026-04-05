/**
 * Permission type definitions.
 *
 * Implements the same types as Claude Code's src/types/permissions.ts.
 * Pure type definitions with no runtime dependencies.
 */
export declare const PERMISSION_MODES: readonly ["acceptEdits", "bypassPermissions", "default", "dontAsk", "plan"];
export type PermissionMode = (typeof PERMISSION_MODES)[number];
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export type PermissionRuleSource = 'userSettings' | 'projectSettings' | 'localSettings' | 'flagSettings' | 'policySettings' | 'cliArg' | 'command' | 'session';
export declare const PERMISSION_RULE_SOURCES: PermissionRuleSource[];
export interface PermissionRuleValue {
    toolName: string;
    ruleContent?: string;
}
export interface PermissionRule {
    source: PermissionRuleSource;
    ruleBehavior: PermissionBehavior;
    ruleValue: PermissionRuleValue;
}
export type ToolPermissionRulesBySource = {
    [K in PermissionRuleSource]?: string[];
};
export interface ToolPermissionContext {
    readonly mode: PermissionMode;
    readonly alwaysAllowRules: ToolPermissionRulesBySource;
    readonly alwaysDenyRules: ToolPermissionRulesBySource;
    readonly alwaysAskRules: ToolPermissionRulesBySource;
    readonly isBypassPermissionsModeAvailable: boolean;
    readonly shouldAvoidPermissionPrompts?: boolean;
    readonly prePlanMode?: PermissionMode;
}
export declare function createEmptyToolPermissionContext(): ToolPermissionContext;
export type PermissionDecisionReason = {
    type: 'rule';
    rule: PermissionRule;
} | {
    type: 'mode';
    mode: PermissionMode;
} | {
    type: 'subcommandResults';
    reasons: Map<string, PermissionResult>;
} | {
    type: 'hook';
    hookName: string;
    hookSource?: string;
    reason?: string;
} | {
    type: 'asyncAgent';
    reason: string;
} | {
    type: 'sandboxOverride';
    reason: string;
} | {
    type: 'classifier';
    classifier: string;
    reason: string;
} | {
    type: 'workingDir';
    reason: string;
} | {
    type: 'safetyCheck';
    reason: string;
    classifierApprovable: boolean;
} | {
    type: 'other';
    reason: string;
};
export interface PermissionAllowDecision {
    behavior: 'allow';
    updatedInput?: Record<string, unknown>;
    userModified?: boolean;
    decisionReason?: PermissionDecisionReason;
    toolUseID?: string;
}
export interface PermissionAskDecision {
    behavior: 'ask';
    message: string;
    updatedInput?: Record<string, unknown>;
    decisionReason?: PermissionDecisionReason;
    suggestions?: unknown[];
    blockedPath?: string;
}
export interface PermissionDenyDecision {
    behavior: 'deny';
    message: string;
    decisionReason: PermissionDecisionReason;
    toolUseID?: string;
}
export type PermissionDecision = PermissionAllowDecision | PermissionAskDecision | PermissionDenyDecision;
export interface PermissionPassthroughResult {
    behavior: 'passthrough';
    message: string;
    decisionReason?: PermissionDecisionReason;
    suggestions?: unknown[];
    blockedPath?: string;
}
export type PermissionResult = PermissionDecision | PermissionPassthroughResult;
//# sourceMappingURL=permissions.d.ts.map