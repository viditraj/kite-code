/**
 * Retry logic for LLM API calls.
 *
 * Implements the same patterns as Claude Code's withRetry.ts:
 * - Exponential backoff with jitter
 * - Differentiated handling for 429 (rate limit) vs 529 (overloaded)
 * - Max retry attempts
 * - Abort signal propagation
 */

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

// ============================================================================
// Error classification
// ============================================================================

export interface RetryableError extends Error {
  status?: number
  retryAfter?: number
}

export function isRetryableStatusCode(status: number): boolean {
  return (
    status === 429 || // Rate limited
    status === 529 || // Overloaded
    status === 500 || // Internal server error
    status === 502 || // Bad gateway
    status === 503 || // Service unavailable
    status === 504    // Gateway timeout
  )
}

export function isRetryableError(error: unknown): error is RetryableError {
  if (error instanceof Error) {
    const e = error as RetryableError
    if (e.status && isRetryableStatusCode(e.status)) return true
    // Network errors
    if (e.message.includes('ECONNREFUSED')) return true
    if (e.message.includes('ECONNRESET')) return true
    if (e.message.includes('ETIMEDOUT')) return true
    if (e.message.includes('fetch failed')) return true
  }
  return false
}

// ============================================================================
// Retry helpers
// ============================================================================

/**
 * Calculate delay with exponential backoff + jitter.
 * Respects Retry-After header when present.
 */
export function calculateRetryDelay(
  attempt: number,
  retryAfterMs?: number,
): number {
  if (retryAfterMs && retryAfterMs > 0) {
    // Add small jitter to retry-after
    return retryAfterMs + Math.random() * 500
  }

  // Exponential backoff: base * 2^attempt + jitter
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * BASE_DELAY_MS
  return Math.min(exponential + jitter, MAX_DELAY_MS)
}

/**
 * Extract retry-after from a Response or Error.
 */
export function extractRetryAfter(response: Response | null, error?: RetryableError): number | undefined {
  // Try response header
  if (response) {
    const header = response.headers.get('retry-after')
    if (header) {
      const seconds = parseFloat(header)
      if (!isNaN(seconds)) return seconds * 1000
      // Could be a date
      const date = new Date(header)
      if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now())
    }
  }
  // Try error property
  return error?.retryAfter
}

/**
 * Sleep for a given duration, respecting an abort signal.
 */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

// ============================================================================
// withRetry — main entry point
// ============================================================================

export interface RetryOptions {
  maxRetries?: number
  signal?: AbortSignal
  onRetry?: (attempt: number, delay: number, error: Error) => void
}

/**
 * Execute a function with retry logic.
 *
 * Retries on retryable errors with exponential backoff.
 * Respects Retry-After headers for rate limiting.
 * Propagates abort signals.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Don't retry abort errors
      if (error instanceof DOMException && error.name === 'AbortError') throw error

      // Don't retry on last attempt
      if (attempt >= maxRetries) throw error

      // Only retry retryable errors
      if (!isRetryableError(error)) throw error

      const retryAfterMs = extractRetryAfter(null, error as RetryableError)
      const delay = calculateRetryDelay(attempt, retryAfterMs)

      options.onRetry?.(attempt + 1, delay, error as Error)

      await sleepWithAbort(delay, options.signal)
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('withRetry: exhausted all retries')
}

/**
 * Wrap a fetch Response, throwing a RetryableError if the status is retryable.
 */
export async function checkResponseOrThrow(response: Response): Promise<Response> {
  if (response.ok) return response

  const status = response.status
  const body = await response.text().catch(() => '')

  const error = new Error(`HTTP ${status}: ${body.slice(0, 200)}`) as RetryableError
  error.status = status
  const retryAfterMs = extractRetryAfter(response)
  if (retryAfterMs !== undefined) error.retryAfter = retryAfterMs

  throw error
}
