import { describe, it, expect } from 'vitest'
import { getTextContent, getToolUseBlocks, hasToolUse, estimateMessageTokens, countToolUses, formatMessagePlainText, getLastAssistantMessage, normalizeMessagesForAPI, stripThinkingBlocks, isUserMessage, isAssistantMessage, countMessagesByRole, formatConversationMarkdown, truncateMessageContent } from './utils/messages.js'
import { findGitRoot, isGitRepo, getGitBranch, getGitStatus, getGitHeadState, type GitHeadState } from './utils/git/index.js'
import { resolveModelAlias, getCanonicalName, getContextWindowForModel, getModelMaxOutputTokens, calculateUSDCost, formatCost, getSmallFastModel, getModelCapabilities, isModelAlias, MODEL_PRICING, MODEL_ALIASES } from './utils/model/index.js'
import { recordUsage, getTotalCost, getTotalInputTokens, getTotalOutputTokens, formatCostSummary, resetCostState, formatDuration, formatNumber, addToTotalLinesChanged, getTotalLinesAdded, saveCurrentSessionCosts, restoreSessionCosts } from './cost-tracker.js'
import { getMemoryFiles as getClaudeMdFiles, buildMemoryPromptSection, parseMemoryFrontmatter, resolveIncludes, type MemoryFile } from './utils/claudemd.js'
import type { UnifiedMessage, ContentBlock } from './providers/types.js'

// ============================================================================
// Messages
// ============================================================================

describe('Message Utilities', () => {
  const textMsg: UnifiedMessage = { role: 'user', content: 'Hello world' }
  const blockMsg: UnifiedMessage = {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Here is the result.' },
      { type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'ls' } },
    ] as ContentBlock[],
  }

  it('getTextContent extracts from string', () => {
    expect(getTextContent(textMsg)).toBe('Hello world')
  })

  it('getTextContent extracts from blocks', () => {
    expect(getTextContent(blockMsg)).toBe('Here is the result.')
  })

  it('getToolUseBlocks extracts tool uses', () => {
    expect(getToolUseBlocks(blockMsg)).toHaveLength(1)
    expect(getToolUseBlocks(blockMsg)[0]!.name).toBe('Bash')
  })

  it('hasToolUse detects tool uses', () => {
    expect(hasToolUse(blockMsg)).toBe(true)
    expect(hasToolUse(textMsg)).toBe(false)
  })

  it('estimateMessageTokens returns positive number', () => {
    expect(estimateMessageTokens(textMsg)).toBeGreaterThan(0)
    expect(estimateMessageTokens(blockMsg)).toBeGreaterThan(0)
  })

  it('countToolUses counts across messages', () => {
    expect(countToolUses([textMsg, blockMsg])).toBe(1)
  })

  it('isUserMessage / isAssistantMessage', () => {
    expect(isUserMessage(textMsg)).toBe(true)
    expect(isAssistantMessage(blockMsg)).toBe(true)
  })

  it('countMessagesByRole', () => {
    const counts = countMessagesByRole([textMsg, blockMsg])
    expect(counts.user).toBe(1)
    expect(counts.assistant).toBe(1)
  })

  it('formatMessagePlainText includes role and content', () => {
    const formatted = formatMessagePlainText(textMsg)
    expect(formatted).toContain('[USER]')
    expect(formatted).toContain('Hello world')
  })

  it('getLastAssistantMessage finds last', () => {
    const last = getLastAssistantMessage([textMsg, blockMsg])
    expect(last).toBe(blockMsg)
  })

  it('normalizeMessagesForAPI merges adjacent same-role', () => {
    const msgs: UnifiedMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ]
    const normalized = normalizeMessagesForAPI(msgs)
    expect(normalized).toHaveLength(2)
  })

  it('stripThinkingBlocks removes thinking', () => {
    const msg: UnifiedMessage = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: 'result' },
      ] as ContentBlock[],
    }
    const stripped = stripThinkingBlocks([msg])
    const content = stripped[0]!.content as ContentBlock[]
    expect(content).toHaveLength(1)
    expect(content[0]!.type).toBe('text')
  })

  it('truncateMessageContent truncates long strings', () => {
    const msg: UnifiedMessage = { role: 'user', content: 'x'.repeat(1000) }
    const truncated = truncateMessageContent(msg, 100)
    expect((truncated.content as string).length).toBeLessThan(200)
  })

  it('formatConversationMarkdown produces markdown', () => {
    const md = formatConversationMarkdown([textMsg, blockMsg])
    expect(md).toContain('# Conversation Export')
    expect(md).toContain('## User')
    expect(md).toContain('## Assistant')
  })
})

// ============================================================================
// Git
// ============================================================================

describe('Git Utilities', () => {
  it('findGitRoot returns string or null', () => {
    const root = findGitRoot()
    // May or may not be in a git repo — just check type
    expect(root === null || typeof root === 'string').toBe(true)
  })

  it('isGitRepo returns boolean', () => {
    expect(typeof isGitRepo()).toBe('boolean')
  })

  it('getGitBranch returns string or null', () => {
    const branch = getGitBranch()
    expect(branch === null || typeof branch === 'string').toBe(true)
  })

  it('getGitStatus returns string', () => {
    const status = getGitStatus()
    expect(typeof status).toBe('string')
  })

  it('getGitHeadState returns proper shape', () => {
    const state = getGitHeadState()
    expect(typeof state.isDetached).toBe('boolean')
    expect(typeof state.isDirty).toBe('boolean')
  })
})

// ============================================================================
// Model
// ============================================================================

describe('Model Utilities', () => {
  it('resolveModelAlias resolves known aliases', () => {
    expect(resolveModelAlias('sonnet')).toContain('claude')
    expect(resolveModelAlias('opus')).toContain('claude')
    expect(resolveModelAlias('haiku')).toContain('claude')
  })

  it('resolveModelAlias returns unknown models as-is', () => {
    expect(resolveModelAlias('my-custom-model')).toBe('my-custom-model')
  })

  it('getCanonicalName normalizes', () => {
    expect(getCanonicalName('Sonnet')).toContain('claude')
  })

  it('getContextWindowForModel returns numbers', () => {
    expect(getContextWindowForModel('claude-sonnet-4-20250514')).toBe(200000)
    expect(getContextWindowForModel('gpt-4o')).toBe(128000)
    expect(getContextWindowForModel('unknown-model')).toBe(128000) // default
  })

  it('getModelMaxOutputTokens returns numbers', () => {
    expect(getModelMaxOutputTokens('claude-sonnet-4-20250514')).toBeGreaterThan(0)
    expect(getModelMaxOutputTokens('unknown')).toBe(8192) // default
  })

  it('calculateUSDCost calculates from usage', () => {
    const cost = calculateUSDCost(
      { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      'claude-sonnet-4-20250514',
    )
    expect(cost).toBeGreaterThan(0)
  })

  it('formatCost formats correctly', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(0.001)).toBe('$0.00')
  })

  it('isModelAlias detects aliases', () => {
    expect(isModelAlias('sonnet')).toBe(true)
    expect(isModelAlias('claude-sonnet-4-20250514')).toBe(false)
  })

  it('getSmallFastModel returns a model', () => {
    expect(getSmallFastModel()).toBeTruthy()
  })

  it('getModelCapabilities returns capabilities', () => {
    const caps = getModelCapabilities('claude-sonnet-4-20250514')
    expect(caps.supportsToolUse).toBe(true)
    expect(caps.contextWindow).toBe(200000)
  })

  it('MODEL_PRICING has entries', () => {
    expect(Object.keys(MODEL_PRICING).length).toBeGreaterThan(10)
  })
})

// ============================================================================
// Cost Tracker
// ============================================================================

describe('Cost Tracker', () => {
  it('starts at zero', () => {
    resetCostState()
    expect(getTotalCost()).toBe(0)
    expect(getTotalInputTokens()).toBe(0)
    expect(getTotalOutputTokens()).toBe(0)
  })

  it('records usage', () => {
    resetCostState()
    recordUsage('test-model', { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 500, 0.01)
    expect(getTotalInputTokens()).toBe(100)
    expect(getTotalOutputTokens()).toBe(50)
    expect(getTotalCost()).toBe(0.01)
  })

  it('accumulates multiple recordings', () => {
    resetCostState()
    recordUsage('m1', { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 100, 0.01)
    recordUsage('m2', { inputTokens: 200, outputTokens: 100, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 200, 0.02)
    expect(getTotalInputTokens()).toBe(300)
    expect(getTotalOutputTokens()).toBe(150)
    expect(getTotalCost()).toBeCloseTo(0.03)
  })

  it('tracks lines changed', () => {
    resetCostState()
    addToTotalLinesChanged(10, 5)
    expect(getTotalLinesAdded()).toBe(10)
  })

  it('formatDuration formats correctly', () => {
    expect(formatDuration(5000)).toBe('5s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(3700000)).toBe('1h 1m')
  })

  it('formatNumber formats with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formatCostSummary produces summary', () => {
    resetCostState()
    recordUsage('test', { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 1000, 0.05)
    const summary = formatCostSummary()
    expect(summary).toContain('Cost:')
    expect(summary).toContain('Tokens:')
    expect(summary).toContain('Requests:')
  })

  it('save/restore round-trips', () => {
    resetCostState()
    recordUsage('m1', { inputTokens: 500, outputTokens: 250, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 1000, 0.05)
    const saved = saveCurrentSessionCosts()
    resetCostState()
    expect(getTotalCost()).toBe(0)
    restoreSessionCosts(saved)
    expect(getTotalCost()).toBe(0.05)
    expect(getTotalInputTokens()).toBe(500)
  })
})

// ============================================================================
// ClaudeMD
// ============================================================================

describe('ClaudeMD', () => {
  it('getClaudeMdFiles returns array', () => {
    const files = getClaudeMdFiles(process.cwd())
    expect(Array.isArray(files)).toBe(true)
  })

  it('buildMemoryPromptSection handles empty array', () => {
    const result = buildMemoryPromptSection([])
    expect(typeof result).toBe('string')
  })

  it('buildMemoryPromptSection formats files', () => {
    const files: MemoryFile[] = [
      { path: '/test/AGENTS.md', content: 'Test content', source: 'project', type: 'memory' },
    ]
    const result = buildMemoryPromptSection(files)
    expect(result).toContain('Test content')
    expect(result).toContain('AGENTS.md')
  })

  it('parseMemoryFrontmatter parses frontmatter', () => {
    const content = '---\ntitle: Test\n---\nBody'
    const { frontmatter, body } = parseMemoryFrontmatter(content)
    expect(frontmatter.title).toBe('Test')
    expect(body).toContain('Body')
  })

  it('parseMemoryFrontmatter handles no frontmatter', () => {
    const { frontmatter, body } = parseMemoryFrontmatter('Just body')
    expect(Object.keys(frontmatter)).toHaveLength(0)
    expect(body).toBe('Just body')
  })

  it('resolveIncludes returns content unchanged without @', () => {
    const result = resolveIncludes('Hello world', '/tmp')
    expect(result).toBe('Hello world')
  })
})
