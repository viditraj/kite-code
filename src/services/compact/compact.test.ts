import { describe, it, expect } from 'vitest'
import { findSplitPoint, messagesToText, PRESERVE_RECENT } from './compact.js'
import type { UnifiedMessage, ContentBlock } from '../../providers/types.js'

describe('findSplitPoint', () => {
  it('returns 0 for short conversations', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]
    expect(findSplitPoint(messages)).toBe(0)
  })

  it('preserves recent messages', () => {
    const messages: UnifiedMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }))
    const split = findSplitPoint(messages)
    expect(split).toBe(messages.length - PRESERVE_RECENT)
  })

  it('does not split tool_use/tool_result pairs', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'do something' },
      { role: 'assistant', content: 'thinking...' },
      { role: 'user', content: 'more input' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }] as ContentBlock[] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'result' }] as ContentBlock[] },
      { role: 'assistant', content: 'done' },
      { role: 'user', content: 'thanks' },
    ]
    const split = findSplitPoint(messages)
    // Should not split between messages[3] (tool_use) and messages[4] (tool_result)
    // With PRESERVE_RECENT=4, naive split would be at 3, which would split the pair
    // The function should move the split to include the tool_result
    expect(split).toBeGreaterThanOrEqual(0)
    if (split > 0 && split < messages.length) {
      // Verify no tool_use at split-1 with tool_result at split
      const prev = messages[split - 1]!
      const cur = messages[split]!
      const prevHasToolUse = Array.isArray(prev.content) &&
        (prev.content as ContentBlock[]).some(b => b.type === 'tool_use')
      const curHasToolResult = Array.isArray(cur.content) &&
        (cur.content as ContentBlock[]).some(b => b.type === 'tool_result')
      expect(prevHasToolUse && curHasToolResult).toBe(false)
    }
  })
})

describe('messagesToText', () => {
  it('converts simple messages', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]
    const text = messagesToText(messages)
    expect(text).toContain('[USER]: Hello')
    expect(text).toContain('[ASSISTANT]: Hi!')
  })

  it('converts content block messages', () => {
    const messages: UnifiedMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me run that.' },
          { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
        ] as ContentBlock[],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'file.txt' },
        ] as ContentBlock[],
      },
    ]
    const text = messagesToText(messages)
    expect(text).toContain('Let me run that.')
    expect(text).toContain('[Tool: Bash]')
    expect(text).toContain('[Result]: file.txt')
  })

  it('handles thinking blocks', () => {
    const messages: UnifiedMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'I should check the files' }] as ContentBlock[],
      },
    ]
    const text = messagesToText(messages)
    expect(text).toContain('[Thinking]')
  })
})
