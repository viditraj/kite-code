import { describe, it, expect } from 'vitest'
import { microCompact, MAX_TOOL_RESULT_CHARS, TRUNCATION_MARKER } from './microCompact.js'
import type { UnifiedMessage, ContentBlock } from '../../providers/types.js'

describe('microCompact', () => {
  it('passes through short messages unchanged', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const result = microCompact(messages)
    expect(result).toEqual(messages)
    // Same references when nothing changed
    expect(result[0]).toBe(messages[0])
  })

  it('truncates oversized tool_result content', () => {
    const bigContent = 'x'.repeat(MAX_TOOL_RESULT_CHARS + 1000)
    const messages: UnifiedMessage[] = [
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'test-1',
          content: bigContent,
        }] as ContentBlock[],
      },
    ]
    const result = microCompact(messages)
    const block = (result[0]!.content as ContentBlock[])[0]!
    expect(block.type).toBe('tool_result')
    const content = (block as any).content as string
    expect(content.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 50) // some margin for marker
    expect(content).toContain(TRUNCATION_MARKER)
  })

  it('preserves start and end of truncated content', () => {
    const start = 'START_MARKER_'
    const end = '_END_MARKER'
    const middle = 'x'.repeat(MAX_TOOL_RESULT_CHARS + 5000)
    const bigContent = start + middle + end

    const messages: UnifiedMessage[] = [
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'test-1',
          content: bigContent,
        }] as ContentBlock[],
      },
    ]
    const result = microCompact(messages)
    const content = ((result[0]!.content as ContentBlock[])[0] as any).content as string
    expect(content.startsWith(start)).toBe(true)
    expect(content.endsWith(end)).toBe(true)
  })

  it('does not mutate input messages', () => {
    const bigContent = 'y'.repeat(MAX_TOOL_RESULT_CHARS + 100)
    const original: UnifiedMessage[] = [
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: bigContent }] as ContentBlock[] },
    ]
    const originalLength = bigContent.length
    microCompact(original)
    // Original should be unchanged
    const block = (original[0]!.content as ContentBlock[])[0]! as any
    expect(block.content.length).toBe(originalLength)
  })

  it('handles string content messages', () => {
    const messages: UnifiedMessage[] = [
      { role: 'user', content: 'short' },
    ]
    const result = microCompact(messages)
    expect(result[0]).toBe(messages[0])
  })

  it('handles nested tool_result arrays', () => {
    const inner: ContentBlock = {
      type: 'text',
      text: 'x'.repeat(60000),
    }
    const messages: UnifiedMessage[] = [
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'test-1',
          content: [inner],
        }] as ContentBlock[],
      },
    ]
    const result = microCompact(messages)
    // The inner text block should be truncated
    const outerBlock = (result[0]!.content as ContentBlock[])[0] as any
    const innerBlock = outerBlock.content[0]
    expect(innerBlock.text.length).toBeLessThan(60000)
  })
})
