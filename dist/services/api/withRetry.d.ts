/**
 * Retry logic for LLM API calls.
 *
 * Implements the same patterns as Claude Code's withRetry.ts:
 * - Exponential backoff with jitter
 * - Differentiated handling for 429 (rate limit) vs 529 (overloaded)
 * - Max retry attempts
 * - Abort signal propagation
 */
export interface RetryableError extends Error {
    status?: number;
    retryAfter?: number;
}
export declare function isRetryableStatusCode(status: number): boolean;
export declare function isRetryableError(error: unknown): error is RetryableError;
/**
 * Calculate delay with exponential backoff + jitter.
 * Respects Retry-After header when present.
 */
export declare function calculateRetryDelay(attempt: number, retryAfterMs?: number): number;
/**
 * Extract retry-after from a Response or Error.
 */
export declare function extractRetryAfter(response: Response | null, error?: RetryableError): number | undefined;
export interface RetryOptions {
    maxRetries?: number;
    signal?: AbortSignal;
    onRetry?: (attempt: number, delay: number, error: Error) => void;
}
/**
 * Execute a function with retry logic.
 *
 * Retries on retryable errors with exponential backoff.
 * Respects Retry-After headers for rate limiting.
 * Propagates abort signals.
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Wrap a fetch Response, throwing a RetryableError if the status is retryable.
 */
export declare function checkResponseOrThrow(response: Response): Promise<Response>;
//# sourceMappingURL=withRetry.d.ts.map