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

import type {
  PermissionRule,
  PermissionRuleSource,
  PermissionDecision,
  PermissionResult,
  PermissionDecisionReason,
  ToolPermissionContext,
  PermissionBehavior,
  PERMISSION_RULE_SOURCES,
} from '../../types/permissions.js'
import { permissionRuleValueFromString, permissionRuleValueToString } from './permissionRuleParser.js'

const RULE_SOURCES: PermissionRuleSource[] = [
  'userSettings', 'projectSettings', 'localSettings',
  'flagSettings', 'policySettings', 'cliArg', 'command', 'session',
]

// ============================================================================
// Rule extraction
// ============================================================================

export function getAllowRules(context: ToolPermissionContext): PermissionRule[] {
  return RULE_SOURCES.flatMap(source =>
    (context.alwaysAllowRules[source] || []).map(ruleString => ({
      source,
      ruleBehavior: 'allow' as PermissionBehavior,
      ruleValue: permissionRuleValueFromString(ruleString),
    }))
  )
}

export function getDenyRules(context: ToolPermissionContext): PermissionRule[] {
  return RULE_SOURCES.flatMap(source =>
    (context.alwaysDenyRules[source] || []).map(ruleString => ({
      source,
      ruleBehavior: 'deny' as PermissionBehavior,
      ruleValue: permissionRuleValueFromString(ruleString),
    }))
  )
}

export function getAskRules(context: ToolPermissionContext): PermissionRule[] {
  return RULE_SOURCES.flatMap(source =>
    (context.alwaysAskRules[source] || []).map(ruleString => ({
      source,
      ruleBehavior: 'ask' as PermissionBehavior,
      ruleValue: permissionRuleValueFromString(ruleString),
    }))
  )
}

// ============================================================================
// Tool-level rule matching
// ============================================================================

/**
 * Check if a tool matches a rule (whole-tool match, no content).
 * Also handles MCP server-level rules like "mcp__server1".
 */
function toolMatchesRule(
  toolName: string,
  mcpInfo: { serverName: string; toolName: string } | undefined,
  rule: PermissionRule,
): boolean {
  // Rule must not have content to match the entire tool
  if (rule.ruleValue.ruleContent !== undefined) {
    return false
  }

  // Direct tool name match
  if (rule.ruleValue.toolName === toolName) {
    return true
  }

  // MCP server-level permission: rule "mcp__server1" matches tool "mcp__server1__tool1"
  if (mcpInfo) {
    const ruleName = rule.ruleValue.toolName
    if (ruleName.startsWith('mcp__')) {
      const parts = ruleName.split('__')
      if (parts.length === 2 && parts[1] === mcpInfo.serverName) {
        return true // Server-level match
      }
      if (parts.length === 3 && parts[1] === mcpInfo.serverName && (parts[2] === '*' || parts[2] === mcpInfo.toolName)) {
        return true
      }
    }
  }

  return false
}

export function getDenyRuleForTool(
  context: ToolPermissionContext,
  toolName: string,
  mcpInfo?: { serverName: string; toolName: string },
): PermissionRule | null {
  return getDenyRules(context).find(rule => toolMatchesRule(toolName, mcpInfo, rule)) || null
}

export function getAskRuleForTool(
  context: ToolPermissionContext,
  toolName: string,
  mcpInfo?: { serverName: string; toolName: string },
): PermissionRule | null {
  return getAskRules(context).find(rule => toolMatchesRule(toolName, mcpInfo, rule)) || null
}

export function getAllowRuleForTool(
  context: ToolPermissionContext,
  toolName: string,
  mcpInfo?: { serverName: string; toolName: string },
): PermissionRule | null {
  return getAllowRules(context).find(rule => toolMatchesRule(toolName, mcpInfo, rule)) || null
}

/**
 * Get content-specific rules for a tool.
 * Returns a map of rule content → PermissionRule.
 */
export function getRuleByContentsForTool(
  context: ToolPermissionContext,
  toolName: string,
  behavior: PermissionBehavior,
): Map<string, PermissionRule> {
  const ruleByContents = new Map<string, PermissionRule>()
  let rules: PermissionRule[]
  switch (behavior) {
    case 'allow': rules = getAllowRules(context); break
    case 'deny': rules = getDenyRules(context); break
    case 'ask': rules = getAskRules(context); break
  }
  for (const rule of rules) {
    if (
      rule.ruleValue.toolName === toolName &&
      rule.ruleValue.ruleContent !== undefined &&
      rule.ruleBehavior === behavior
    ) {
      ruleByContents.set(rule.ruleValue.ruleContent, rule)
    }
  }
  return ruleByContents
}

// ============================================================================
// Permission request message
// ============================================================================

export function createPermissionRequestMessage(
  toolName: string,
  decisionReason?: PermissionDecisionReason,
): string {
  if (decisionReason) {
    switch (decisionReason.type) {
      case 'hook':
        return decisionReason.reason
          ? `Hook '${decisionReason.hookName}' blocked this action: ${decisionReason.reason}`
          : `Hook '${decisionReason.hookName}' requires approval for this ${toolName} command`
      case 'rule': {
        const ruleStr = permissionRuleValueToString(decisionReason.rule.ruleValue)
        return `Permission rule '${ruleStr}' from ${decisionReason.rule.source} requires approval for this ${toolName} command`
      }
      case 'workingDir':
        return decisionReason.reason
      case 'safetyCheck':
      case 'other':
        return decisionReason.reason
      case 'mode':
        return `Current permission mode (${decisionReason.mode}) requires approval for this ${toolName} command`
      case 'asyncAgent':
        return decisionReason.reason
    }
  }
  return `Kite wants to use ${toolName}, but you haven't granted permission yet.`
}

// ============================================================================
// Main evaluation chain
// ============================================================================

interface ToolForPermissionCheck {
  name: string
  mcpInfo?: { serverName: string; toolName: string }
  inputSchema: { parse: (input: unknown) => unknown; safeParse: (input: unknown) => { success: boolean; data?: unknown } }
  checkPermissions: (input: unknown, context: unknown) => Promise<PermissionResult>
  requiresUserInteraction?: () => boolean
}

/**
 * Main permission check — implements hasPermissionsToUseToolInner.
 *
 * Steps 1a-1g, 2a-2b, 3 from Claude Code's permissions.ts.
 */
export async function hasPermissionsToUseToolInner(
  tool: ToolForPermissionCheck,
  input: Record<string, unknown>,
  permContext: ToolPermissionContext,
  toolUseContext?: unknown,
): Promise<PermissionDecision> {
  // Step 1a: Entire tool is denied by rule
  const denyRule = getDenyRuleForTool(permContext, tool.name, tool.mcpInfo)
  if (denyRule) {
    return {
      behavior: 'deny',
      message: `Permission to use ${tool.name} has been denied.`,
      decisionReason: { type: 'rule', rule: denyRule },
    }
  }

  // Step 1b: Entire tool has an ask rule
  const askRule = getAskRuleForTool(permContext, tool.name, tool.mcpInfo)
  if (askRule) {
    return {
      behavior: 'ask',
      message: createPermissionRequestMessage(tool.name),
      decisionReason: { type: 'rule', rule: askRule },
    }
  }

  // Step 1c: Ask the tool implementation for a permission result
  let toolPermissionResult: PermissionResult = {
    behavior: 'passthrough',
    message: createPermissionRequestMessage(tool.name),
  }
  try {
    const parsedInput = tool.inputSchema.parse(input)
    toolPermissionResult = await tool.checkPermissions(parsedInput, toolUseContext)
  } catch {
    // Parse failures fall through to passthrough
  }

  // Step 1d: Tool implementation denied permission
  if (toolPermissionResult.behavior === 'deny') {
    return toolPermissionResult as PermissionDecision
  }

  // Step 1e: Tool requires user interaction even in bypass mode
  if (
    tool.requiresUserInteraction?.() &&
    toolPermissionResult.behavior === 'ask'
  ) {
    return toolPermissionResult as PermissionDecision
  }

  // Step 1f: Content-specific ask rules take precedence over bypass mode
  if (
    toolPermissionResult.behavior === 'ask' &&
    toolPermissionResult.decisionReason?.type === 'rule' &&
    (toolPermissionResult.decisionReason as { type: 'rule'; rule: PermissionRule }).rule.ruleBehavior === 'ask'
  ) {
    return toolPermissionResult as PermissionDecision
  }

  // Step 1g: Safety checks are bypass-immune
  if (
    toolPermissionResult.behavior === 'ask' &&
    toolPermissionResult.decisionReason?.type === 'safetyCheck'
  ) {
    return toolPermissionResult as PermissionDecision
  }

  // Step 2a: Check if mode allows the tool to run (bypass)
  const shouldBypass =
    permContext.mode === 'bypassPermissions' ||
    (permContext.mode === 'plan' && permContext.isBypassPermissionsModeAvailable)
  if (shouldBypass) {
    return {
      behavior: 'allow',
      updatedInput: getUpdatedInputOrFallback(toolPermissionResult, input),
      decisionReason: { type: 'mode', mode: permContext.mode },
    }
  }

  // Step 2b: Entire tool is allowed by rule
  const allowRule = getAllowRuleForTool(permContext, tool.name, tool.mcpInfo)
  if (allowRule) {
    return {
      behavior: 'allow',
      updatedInput: getUpdatedInputOrFallback(toolPermissionResult, input),
      decisionReason: { type: 'rule', rule: allowRule },
    }
  }

  // Step 3: Convert passthrough to ask
  if (toolPermissionResult.behavior === 'passthrough') {
    return {
      behavior: 'ask',
      message: createPermissionRequestMessage(tool.name, toolPermissionResult.decisionReason),
      decisionReason: toolPermissionResult.decisionReason,
    }
  }

  return toolPermissionResult as PermissionDecision
}

/**
 * Outer wrapper — applies dontAsk and shouldAvoidPermissionPrompts.
 */
export async function hasPermissionsToUseTool(
  tool: ToolForPermissionCheck,
  input: Record<string, unknown>,
  permContext: ToolPermissionContext,
  toolUseContext?: unknown,
): Promise<PermissionDecision> {
  const result = await hasPermissionsToUseToolInner(tool, input, permContext, toolUseContext)

  // Apply dontAsk mode: convert ask → deny
  if (result.behavior === 'ask' && permContext.mode === 'dontAsk') {
    return {
      behavior: 'deny',
      message: `Permission mode 'dontAsk' denied ${tool.name}.`,
      decisionReason: { type: 'mode', mode: 'dontAsk' },
    }
  }

  // Apply shouldAvoidPermissionPrompts: convert ask → deny for headless agents
  if (result.behavior === 'ask' && permContext.shouldAvoidPermissionPrompts) {
    return {
      behavior: 'deny',
      message: 'Permission prompts are not available in this context.',
      decisionReason: { type: 'asyncAgent', reason: 'Permission prompts are not available in this context' },
    }
  }

  return result
}

// ============================================================================
// Helpers
// ============================================================================

function getUpdatedInputOrFallback(
  permissionResult: PermissionResult,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  if ('updatedInput' in permissionResult && permissionResult.updatedInput) {
    return permissionResult.updatedInput
  }
  return fallback
}
