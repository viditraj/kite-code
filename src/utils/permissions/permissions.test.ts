import { describe, it, expect } from 'vitest'
import { permissionRuleValueFromString, permissionRuleValueToString, escapeRuleContent, unescapeRuleContent } from './permissionRuleParser.js'
import { matchWildcardPattern, hasWildcards, permissionRuleExtractPrefix, parsePermissionRule } from './shellRuleMatching.js'
import { createDenialTrackingState, recordDenial, recordSuccess, shouldFallbackToPrompting } from './denialTracking.js'
import { hasPermissionsToUseTool, hasPermissionsToUseToolInner, getDenyRuleForTool, getAllowRuleForTool, getAskRuleForTool, createPermissionRequestMessage } from './permissions.js'
import type { ToolPermissionContext } from '../../types/permissions.js'
import { z } from 'zod'

// ============================================================================
// Rule Parser Tests
// ============================================================================

describe('permissionRuleValueFromString', () => {
  it('parses tool name only', () => {
    const rv = permissionRuleValueFromString('Bash')
    expect(rv.toolName).toBe('Bash')
    expect(rv.ruleContent).toBeUndefined()
  })

  it('parses tool with content', () => {
    const rv = permissionRuleValueFromString('Bash(npm install)')
    expect(rv.toolName).toBe('Bash')
    expect(rv.ruleContent).toBe('npm install')
  })

  it('handles escaped parentheses', () => {
    const rv = permissionRuleValueFromString('Bash(python -c "print\\(1\\)")')
    expect(rv.toolName).toBe('Bash')
    expect(rv.ruleContent).toContain('print(1)')
  })

  it('treats empty content as tool-wide', () => {
    expect(permissionRuleValueFromString('Bash()').ruleContent).toBeUndefined()
  })

  it('treats wildcard content as tool-wide', () => {
    expect(permissionRuleValueFromString('Bash(*)').ruleContent).toBeUndefined()
  })

  it('handles malformed rules', () => {
    expect(permissionRuleValueFromString('(foo)').toolName).toBe('(foo)')
  })
})

describe('permissionRuleValueToString', () => {
  it('round-trips correctly', () => {
    const original = 'Bash(npm install)'
    const parsed = permissionRuleValueFromString(original)
    expect(permissionRuleValueToString(parsed)).toBe(original)
  })

  it('handles tool name only', () => {
    expect(permissionRuleValueToString({ toolName: 'FileRead' })).toBe('FileRead')
  })
})

describe('escapeRuleContent / unescapeRuleContent', () => {
  it('round-trips', () => {
    const original = 'print(1)'
    expect(unescapeRuleContent(escapeRuleContent(original))).toBe(original)
  })

  it('escapes backslashes first', () => {
    const escaped = escapeRuleContent('a\\b(c)')
    expect(escaped).toContain('\\\\')
    expect(escaped).toContain('\\(')
  })
})

// ============================================================================
// Shell Rule Matching Tests
// ============================================================================

describe('hasWildcards', () => {
  it('detects unescaped wildcards', () => {
    expect(hasWildcards('git *')).toBe(true)
    expect(hasWildcards('npm:*')).toBe(false) // Legacy prefix
    expect(hasWildcards('echo hello')).toBe(false)
    expect(hasWildcards('echo \\*')).toBe(false) // Escaped
  })
})

describe('matchWildcardPattern', () => {
  it('matches exact', () => {
    expect(matchWildcardPattern('echo hello', 'echo hello')).toBe(true)
    expect(matchWildcardPattern('echo hello', 'echo world')).toBe(false)
  })

  it('matches wildcard', () => {
    expect(matchWildcardPattern('git *', 'git add')).toBe(true)
    expect(matchWildcardPattern('git *', 'git commit -m "msg"')).toBe(true)
  })

  it('optional trailing for single wildcard', () => {
    expect(matchWildcardPattern('git *', 'git')).toBe(true)
  })

  it('multi-wildcard not optional', () => {
    expect(matchWildcardPattern('* run *', 'npm run test')).toBe(true)
    expect(matchWildcardPattern('* run *', 'npm run')).toBe(false)
  })

  it('escaped star matches literal', () => {
    expect(matchWildcardPattern('echo \\*', 'echo *')).toBe(true)
    expect(matchWildcardPattern('echo \\*', 'echo hello')).toBe(false)
  })

  it('matches with special regex chars', () => {
    expect(matchWildcardPattern('rm -rf *', 'rm -rf /tmp/foo')).toBe(true)
  })

  it('case insensitive', () => {
    expect(matchWildcardPattern('GIT *', 'git add', true)).toBe(true)
    expect(matchWildcardPattern('GIT *', 'git add', false)).toBe(false)
  })

  it('dotAll matches newlines', () => {
    expect(matchWildcardPattern('echo *', 'echo hello\nworld')).toBe(true)
  })
})

describe('parsePermissionRule', () => {
  it('parses exact', () => {
    const rule = parsePermissionRule('echo hello')
    expect(rule.type).toBe('exact')
  })

  it('parses prefix', () => {
    const rule = parsePermissionRule('npm:*')
    expect(rule.type).toBe('prefix')
    expect((rule as { prefix: string }).prefix).toBe('npm')
  })

  it('parses wildcard', () => {
    const rule = parsePermissionRule('git *')
    expect(rule.type).toBe('wildcard')
  })
})

// ============================================================================
// Denial Tracking Tests
// ============================================================================

describe('denialTracking', () => {
  it('tracks consecutive denials', () => {
    let state = createDenialTrackingState()
    state = recordDenial(state)
    state = recordDenial(state)
    state = recordDenial(state)
    expect(state.consecutiveDenials).toBe(3)
    expect(shouldFallbackToPrompting(state)).toBe(true)
  })

  it('resets on success', () => {
    let state = createDenialTrackingState()
    state = recordDenial(state)
    state = recordDenial(state)
    state = recordSuccess(state)
    expect(state.consecutiveDenials).toBe(0)
    expect(state.totalDenials).toBe(2)
    expect(shouldFallbackToPrompting(state)).toBe(false)
  })

  it('success with zero denials returns same reference', () => {
    const state = createDenialTrackingState()
    const same = recordSuccess(state)
    expect(same).toBe(state)
  })

  it('tracks total denials across resets', () => {
    let state = createDenialTrackingState()
    for (let i = 0; i < 20; i++) {
      state = recordDenial(state)
      state = recordSuccess(state)
    }
    expect(state.totalDenials).toBe(20)
    expect(shouldFallbackToPrompting(state)).toBe(true)
  })
})

// ============================================================================
// Permission Engine Tests
// ============================================================================

function makeContext(overrides: Partial<ToolPermissionContext> = {}): ToolPermissionContext {
  return {
    mode: 'default',
    alwaysAllowRules: {},
    alwaysDenyRules: {},
    alwaysAskRules: {},
    isBypassPermissionsModeAvailable: false,
    ...overrides,
  }
}

function makeTool(name: string, checkResult?: any) {
  return {
    name,
    inputSchema: z.strictObject({ command: z.string().optional() }),
    checkPermissions: async () => checkResult ?? { behavior: 'passthrough' as const, message: 'default' },
  }
}

describe('getDenyRuleForTool / getAllowRuleForTool / getAskRuleForTool', () => {
  it('finds deny rule', () => {
    const ctx = makeContext({ alwaysDenyRules: { userSettings: ['Bash'] } })
    expect(getDenyRuleForTool(ctx, 'Bash')).not.toBeNull()
    expect(getDenyRuleForTool(ctx, 'FileRead')).toBeNull()
  })

  it('finds allow rule', () => {
    const ctx = makeContext({ alwaysAllowRules: { userSettings: ['FileRead'] } })
    expect(getAllowRuleForTool(ctx, 'FileRead')).not.toBeNull()
  })

  it('finds ask rule', () => {
    const ctx = makeContext({ alwaysAskRules: { userSettings: ['Bash'] } })
    expect(getAskRuleForTool(ctx, 'Bash')).not.toBeNull()
  })
})

describe('hasPermissionsToUseToolInner', () => {
  it('step 1a: deny rule blocks tool', async () => {
    const ctx = makeContext({ alwaysDenyRules: { userSettings: ['Bash'] } })
    const result = await hasPermissionsToUseToolInner(makeTool('Bash'), {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('step 1b: ask rule prompts', async () => {
    const ctx = makeContext({ alwaysAskRules: { userSettings: ['Bash'] } })
    const result = await hasPermissionsToUseToolInner(makeTool('Bash'), {}, ctx)
    expect(result.behavior).toBe('ask')
  })

  it('step 1d: tool denies', async () => {
    const ctx = makeContext()
    const tool = makeTool('Custom', { behavior: 'deny', message: 'denied', decisionReason: { type: 'other', reason: 'test' } })
    const result = await hasPermissionsToUseToolInner(tool, {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('step 1g: safety check bypasses bypass mode', async () => {
    const ctx = makeContext({ mode: 'bypassPermissions' })
    const tool = makeTool('FileEdit', { behavior: 'ask', message: 'dangerous', decisionReason: { type: 'safetyCheck', reason: 'dangerous', classifierApprovable: true } })
    const result = await hasPermissionsToUseToolInner(tool, {}, ctx)
    expect(result.behavior).toBe('ask') // NOT allowed despite bypass mode
  })

  it('step 2a: bypass mode allows', async () => {
    const ctx = makeContext({ mode: 'bypassPermissions' })
    const result = await hasPermissionsToUseToolInner(makeTool('Custom'), {}, ctx)
    expect(result.behavior).toBe('allow')
  })

  it('step 2a: deny rules still apply in bypass mode', async () => {
    const ctx = makeContext({ mode: 'bypassPermissions', alwaysDenyRules: { userSettings: ['Bash'] } })
    const result = await hasPermissionsToUseToolInner(makeTool('Bash'), {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('step 2b: allow rule allows', async () => {
    const ctx = makeContext({ alwaysAllowRules: { userSettings: ['FileRead'] } })
    const result = await hasPermissionsToUseToolInner(makeTool('FileRead'), {}, ctx)
    expect(result.behavior).toBe('allow')
  })

  it('step 3: passthrough becomes ask', async () => {
    const ctx = makeContext()
    const result = await hasPermissionsToUseToolInner(makeTool('Unknown'), {}, ctx)
    expect(result.behavior).toBe('ask')
  })
})

describe('hasPermissionsToUseTool (outer wrapper)', () => {
  it('dontAsk converts ask to deny', async () => {
    const ctx = makeContext({ mode: 'dontAsk' })
    const result = await hasPermissionsToUseTool(makeTool('Custom'), {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('headless agent auto-denies ask', async () => {
    const ctx = makeContext({ shouldAvoidPermissionPrompts: true })
    const result = await hasPermissionsToUseTool(makeTool('Custom'), {}, ctx)
    expect(result.behavior).toBe('deny')
    expect(result.decisionReason?.type).toBe('asyncAgent')
  })

  it('plan mode with bypass available allows', async () => {
    const ctx = makeContext({ mode: 'plan', isBypassPermissionsModeAvailable: true })
    const result = await hasPermissionsToUseTool(makeTool('Custom'), {}, ctx)
    expect(result.behavior).toBe('allow')
  })
})
