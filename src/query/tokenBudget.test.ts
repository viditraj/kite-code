import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBudgetTracker, checkTokenBudget, estimateTokenCount } from './tokenBudget.js'

describe('BudgetTracker', () => {
  it('creates with zero state', () => {
    const tracker = createBudgetTracker()
    expect(tracker.continuationCount).toBe(0)
    expect(tracker.cumulativeOutputTokens).toBe(0)
    expect(tracker.lastDeltaTokens).toBe(0)
  })
})

describe('checkTokenBudget', () => {
  it('continues when under threshold', () => {
    const tracker = createBudgetTracker()
    const decision = checkTokenBudget(tracker, 10000, 500)
    expect(decision.action).toBe('continue')
    expect(tracker.continuationCount).toBe(1)
    expect(tracker.cumulativeOutputTokens).toBe(500)
  })

  it('stops at 90% budget threshold', () => {
    const tracker = createBudgetTracker()
    // First call uses 9000/10000 = 90%
    const decision = checkTokenBudget(tracker, 10000, 9000)
    expect(decision.action).toBe('stop')
    expect(decision.reason).toContain('budget threshold')
  })

  it('stops at max continuations', () => {
    const tracker = createBudgetTracker()
    // Simulate 10 continuations
    for (let i = 0; i < 9; i++) {
      checkTokenBudget(tracker, 100000, 100)
    }
    const decision = checkTokenBudget(tracker, 100000, 100)
    expect(decision.action).toBe('stop')
    expect(decision.reason).toContain('max continuations')
  })

  it('stops on unproductive turn (after first)', () => {
    const tracker = createBudgetTracker()
    checkTokenBudget(tracker, 100000, 1000) // first turn
    checkTokenBudget(tracker, 100000, 1000) // second turn
    const decision = checkTokenBudget(tracker, 100000, 10) // unproductive
    expect(decision.action).toBe('stop')
    expect(decision.reason).toContain('unproductive')
  })

  it('ignores low output on first turn', () => {
    const tracker = createBudgetTracker()
    const decision = checkTokenBudget(tracker, 100000, 10)
    expect(decision.action).toBe('continue')
  })
})

describe('estimateTokenCount', () => {
  it('estimates text messages', () => {
    const messages = [
      { content: 'Hello world' }, // 11 chars / 4 ≈ 3 + 4 overhead
      { content: 'Another message' },
    ]
    const count = estimateTokenCount(messages)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(100)
  })

  it('estimates content block messages', () => {
    const messages = [
      {
        content: [
          { type: 'text', text: 'Hello world' },
          { type: 'tool_use', input: { command: 'ls' } },
          { type: 'tool_result', content: 'file.txt\ndir/' },
        ],
      },
    ]
    const count = estimateTokenCount(messages)
    expect(count).toBeGreaterThan(5)
  })

  it('returns zero for empty array', () => {
    expect(estimateTokenCount([])).toBe(0)
  })
})
