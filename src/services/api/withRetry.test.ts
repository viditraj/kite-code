import { describe, it, expect } from 'vitest'
import {
  isRetryableStatusCode,
  isRetryableError,
  calculateRetryDelay,
  extractRetryAfter,
  withRetry,
  checkResponseOrThrow,
} from './withRetry.js'

describe('isRetryableStatusCode', () => {
  it('retries 429', () => expect(isRetryableStatusCode(429)).toBe(true))
  it('retries 529', () => expect(isRetryableStatusCode(529)).toBe(true))
  it('retries 500', () => expect(isRetryableStatusCode(500)).toBe(true))
  it('retries 502', () => expect(isRetryableStatusCode(502)).toBe(true))
  it('retries 503', () => expect(isRetryableStatusCode(503)).toBe(true))
  it('retries 504', () => expect(isRetryableStatusCode(504)).toBe(true))
  it('does not retry 400', () => expect(isRetryableStatusCode(400)).toBe(false))
  it('does not retry 401', () => expect(isRetryableStatusCode(401)).toBe(false))
  it('does not retry 404', () => expect(isRetryableStatusCode(404)).toBe(false))
})

describe('isRetryableError', () => {
  it('retries errors with retryable status', () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('retries network errors', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true)
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true)
    expect(isRetryableError(new Error('fetch failed'))).toBe(true)
  })

  it('does not retry auth errors', () => {
    const err = Object.assign(new Error('unauthorized'), { status: 401 })
    expect(isRetryableError(err)).toBe(false)
  })

  it('does not retry non-errors', () => {
    expect(isRetryableError('string')).toBe(false)
    expect(isRetryableError(null)).toBe(false)
  })
})

describe('calculateRetryDelay', () => {
  it('increases with attempt number', () => {
    const d0 = calculateRetryDelay(0)
    const d1 = calculateRetryDelay(1)
    const d2 = calculateRetryDelay(2)
    // Exponential, but with jitter — just check ordering is roughly right
    expect(d1).toBeGreaterThanOrEqual(d0 * 0.5)
    expect(d2).toBeGreaterThanOrEqual(d1 * 0.5)
  })

  it('respects retry-after', () => {
    const delay = calculateRetryDelay(0, 5000)
    expect(delay).toBeGreaterThanOrEqual(5000)
    expect(delay).toBeLessThan(6000) // small jitter
  })

  it('caps at 30 seconds', () => {
    const delay = calculateRetryDelay(100) // Very high attempt
    expect(delay).toBeLessThanOrEqual(30000)
  })
})

describe('extractRetryAfter', () => {
  it('extracts from response header (seconds)', () => {
    const response = new Response('', {
      headers: { 'retry-after': '5' },
    })
    expect(extractRetryAfter(response)).toBe(5000)
  })

  it('extracts from error property', () => {
    const err = Object.assign(new Error(), { retryAfter: 3000 })
    expect(extractRetryAfter(null, err as any)).toBe(3000)
  })

  it('returns undefined when not present', () => {
    const response = new Response('')
    expect(extractRetryAfter(response)).toBeUndefined()
  })
})

describe('withRetry', () => {
  it('returns on first success', async () => {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      return 42
    })
    expect(result).toBe(42)
    expect(calls).toBe(1)
  })

  it('retries on retryable error', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw Object.assign(new Error('rate limited'), { status: 429 })
        return 'ok'
      },
      { maxRetries: 3 },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('throws on non-retryable error', async () => {
    await expect(
      withRetry(async () => {
        throw Object.assign(new Error('bad request'), { status: 400 })
      }),
    ).rejects.toThrow('bad request')
  })

  it('throws after max retries', async () => {
    await expect(
      withRetry(
        async () => {
          throw Object.assign(new Error('rate limited'), { status: 429 })
        },
        { maxRetries: 2 },
      ),
    ).rejects.toThrow('rate limited')
  })

  it('calls onRetry callback', async () => {
    const retries: number[] = []
    await withRetry(
      async () => {
        if (retries.length < 2) throw Object.assign(new Error('err'), { status: 500 })
        return 'ok'
      },
      {
        maxRetries: 3,
        onRetry: (attempt) => retries.push(attempt),
      },
    )
    expect(retries).toEqual([1, 2])
  })

  it('respects abort signal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      withRetry(
        async () => {
          throw Object.assign(new Error('rate limited'), { status: 429 })
        },
        { maxRetries: 3, signal: controller.signal },
      ),
    ).rejects.toThrow()
  })
})

describe('checkResponseOrThrow', () => {
  it('passes through ok responses', async () => {
    const response = new Response('ok', { status: 200 })
    const result = await checkResponseOrThrow(response)
    expect(result).toBe(response)
  })

  it('throws retryable error for 429', async () => {
    const response = new Response('rate limited', { status: 429 })
    try {
      await checkResponseOrThrow(response)
      expect.unreachable()
    } catch (err: any) {
      expect(err.status).toBe(429)
      expect(isRetryableError(err)).toBe(true)
    }
  })
})
