/**
 * HttpRequestTool — Full HTTP client for API interactions.
 *
 * Supports all HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS),
 * custom headers, request bodies (JSON, text, form-urlencoded), authentication
 * (Bearer, Basic, custom header), and structured response output.
 *
 * Unlike WebFetchTool (which is read-only HTML→Markdown for browsing),
 * this tool is designed for API calls: REST endpoints, webhooks, JIRA,
 * Confluence, GitHub, Slack, and any HTTP-based service.
 *
 * Security:
 * - No file:// or other non-HTTP schemes
 * - No embedded credentials in URLs
 * - Secrets in headers are masked in summaries (not in actual responses)
 * - Request bodies are validated for size limits
 * - Timeout and abort support
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const HTTP_REQUEST_TOOL_NAME = 'HttpRequest'
const MAX_BODY_SIZE = 5 * 1024 * 1024 // 5MB request body limit
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB response limit
const MAX_RESPONSE_TEXT = 200_000 // chars returned to LLM
const DEFAULT_TIMEOUT_MS = 60_000 // 60 seconds
const MAX_TIMEOUT_MS = 300_000 // 5 minutes
const MAX_URL_LENGTH = 4000
const MAX_REDIRECTS = 10
const USER_AGENT = 'Kite-HttpRequest/1.0'

// ============================================================================
// Input schema
// ============================================================================

const inputSchema = z.strictObject({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .describe('HTTP method'),
  url: z.string().describe('The URL to send the request to'),
  headers: z.record(z.string()).optional()
    .describe('Request headers as key-value pairs (e.g., {"Authorization": "Bearer token", "Content-Type": "application/json"})'),
  body: z.string().optional()
    .describe('Request body (string). For JSON APIs, pass a JSON string. For form data, pass URL-encoded string.'),
  timeout: z.number().optional()
    .describe(`Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}, max: ${MAX_TIMEOUT_MS})`),
  followRedirects: z.boolean().optional()
    .describe('Whether to follow HTTP redirects (default: true)'),
})

type HttpRequestInput = z.infer<typeof inputSchema>

// ============================================================================
// Output types
// ============================================================================

interface HttpRequestOutput {
  url: string
  method: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyBytes: number
  durationMs: number
  redirected: boolean
  finalUrl: string
  error: string | null
}

// ============================================================================
// URL validation
// ============================================================================

function validateRequestUrl(url: string): string | null {
  if (url.length > MAX_URL_LENGTH) {
    return `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `Unsupported protocol: ${parsed.protocol} — only http: and https: are allowed`
    }
    if (parsed.username || parsed.password) {
      return 'URLs with embedded credentials are not allowed — use the headers parameter for authentication'
    }
    return null
  } catch {
    return `Invalid URL: ${url}`
  }
}

// ============================================================================
// Header masking for summaries (never mask actual response data)
// ============================================================================

const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^x-api-key$/i,
  /^api-key$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^proxy-authorization$/i,
  /token/i,
  /secret/i,
  /password/i,
]

function isSensitiveHeader(key: string): boolean {
  return SENSITIVE_HEADER_PATTERNS.some(p => p.test(key))
}

function maskHeaderValue(key: string, value: string): string {
  if (isSensitiveHeader(key)) {
    if (value.length <= 8) return '***'
    return value.slice(0, 4) + '***' + value.slice(-4)
  }
  return value
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    masked[k] = maskHeaderValue(k, v)
  }
  return masked
}

// ============================================================================
// Response body formatting
// ============================================================================

function formatResponseBody(
  buffer: ArrayBuffer,
  contentType: string,
): { text: string; isJson: boolean } {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)

  // Try to pretty-print JSON
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      const parsed = JSON.parse(text)
      const pretty = JSON.stringify(parsed, null, 2)
      return { text: pretty, isJson: true }
    } catch {
      // Not valid JSON despite content-type — return raw
    }
  }

  // Auto-detect JSON from body content
  const trimmed = text.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed)
      const pretty = JSON.stringify(parsed, null, 2)
      return { text: pretty, isJson: true }
    } catch {
      // Not JSON
    }
  }

  return { text, isJson: false }
}

// ============================================================================
// Tool definition
// ============================================================================

export const HttpRequestTool = buildTool({
  name: HTTP_REQUEST_TOOL_NAME,
  searchHint: 'http request api call rest post put patch delete webhook curl fetch',
  maxResultSizeChars: 200_000,
  shouldDefer: true,

  inputSchema,

  async description(input: HttpRequestInput) {
    return `${input.method} ${input.url}`
  },

  async prompt() {
    return `Send an HTTP request to any URL. Supports all standard HTTP methods and is designed for API interactions.

Use this tool for:
- REST API calls (GET, POST, PUT, PATCH, DELETE)
- Webhook triggers
- JIRA, Confluence, GitHub, Slack API interactions
- Any HTTP-based service that requires authentication or request bodies

Input:
- method: HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- url: The target URL (http or https)
- headers: (optional) Key-value object of request headers
- body: (optional) Request body as a string. For JSON, pass a JSON string and set Content-Type header.
- timeout: (optional) Timeout in ms (default: ${DEFAULT_TIMEOUT_MS}, max: ${MAX_TIMEOUT_MS})
- followRedirects: (optional) Follow redirects (default: true)

Response includes: status code, headers, body, timing, redirect info.
JSON responses are automatically pretty-printed.
Response body is limited to ${MAX_RESPONSE_TEXT.toLocaleString()} characters.

Examples:
- GET with auth: { method: "GET", url: "https://api.example.com/data", headers: {"Authorization": "Bearer TOKEN"} }
- POST JSON: { method: "POST", url: "https://api.example.com/items", headers: {"Content-Type": "application/json"}, body: '{"name":"test"}' }
- JIRA: { method: "GET", url: "https://company.atlassian.net/rest/api/3/search?jql=...", headers: {"Authorization": "Basic BASE64"} }`
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return false // POST/PUT/DELETE can modify remote state
  },

  userFacingName() {
    return 'HttpRequest'
  },

  toAutoClassifierInput(input: HttpRequestInput) {
    return `${input.method} ${input.url}`
  },

  getToolUseSummary(input?: Partial<HttpRequestInput>) {
    if (!input?.url || !input?.method) return null
    const display = input.url.length > 70 ? input.url.slice(0, 70) + '...' : input.url
    return `${input.method} ${display}`
  },

  getActivityDescription(input?: Partial<HttpRequestInput>) {
    if (!input?.url || !input?.method) return 'Sending HTTP request'
    const display = input.url.length > 50 ? input.url.slice(0, 50) + '...' : input.url
    return `${input.method} ${display}`
  },

  async checkPermissions(input: Record<string, unknown>) {
    const method = input.method as string | undefined
    // GET, HEAD, OPTIONS are safe reads — auto-allow
    if (method && ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    // Mutating methods need permission check (passthrough to default logic)
    return { behavior: 'passthrough' as const, message: `HttpRequest ${method} to ${input.url}` }
  },

  async validateInput(input: HttpRequestInput) {
    // Validate URL
    const urlError = validateRequestUrl(input.url)
    if (urlError) {
      return { result: false, message: urlError, errorCode: 1 }
    }

    // Validate body size
    if (input.body !== undefined) {
      const bodyBytes = new TextEncoder().encode(input.body).length
      if (bodyBytes > MAX_BODY_SIZE) {
        return {
          result: false,
          message: `Request body too large: ${bodyBytes.toLocaleString()} bytes (max ${MAX_BODY_SIZE.toLocaleString()})`,
          errorCode: 2,
        }
      }
    }

    // Validate timeout
    if (input.timeout !== undefined) {
      if (input.timeout <= 0) {
        return { result: false, message: 'Timeout must be positive', errorCode: 3 }
      }
      if (input.timeout > MAX_TIMEOUT_MS) {
        return {
          result: false,
          message: `Timeout exceeds maximum of ${MAX_TIMEOUT_MS}ms (${MAX_TIMEOUT_MS / 1000}s)`,
          errorCode: 4,
        }
      }
    }

    // Body not allowed for GET/HEAD
    if (input.body !== undefined && ['GET', 'HEAD'].includes(input.method)) {
      return {
        result: false,
        message: `Request body is not allowed for ${input.method} requests`,
        errorCode: 5,
      }
    }

    return { result: true }
  },

  async call(input: HttpRequestInput, context: ToolUseContext) {
    const startTime = Date.now()
    const timeoutMs = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort('timeout'), timeoutMs)

    // Link to parent abort
    const onParentAbort = () => abortController.abort('parent_abort')
    context.abortController.signal.addEventListener('abort', onParentAbort)

    try {
      // Build request headers
      const requestHeaders: Record<string, string> = {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        ...input.headers,
      }

      // Auto-set Content-Type for body if not specified
      if (input.body !== undefined && !requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
        const trimmed = input.body.trim()
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          requestHeaders['Content-Type'] = 'application/json'
        }
      }

      const fetchOptions: RequestInit = {
        method: input.method,
        headers: requestHeaders,
        signal: abortController.signal,
        redirect: input.followRedirects === false ? 'manual' : 'follow',
      }

      if (input.body !== undefined && !['GET', 'HEAD'].includes(input.method)) {
        fetchOptions.body = input.body
      }

      // Track redirects manually for redirect count safety
      let response: Response
      let redirectCount = 0
      let currentUrl = input.url

      if (input.followRedirects === false) {
        response = await fetch(currentUrl, fetchOptions)
      } else {
        // Use fetch with redirect: 'follow' but enforce max redirects
        // Node.js fetch handles redirects internally, but we set a max
        fetchOptions.redirect = 'manual'
        response = await fetch(currentUrl, fetchOptions)

        while (response.status >= 300 && response.status < 400 && redirectCount < MAX_REDIRECTS) {
          const location = response.headers.get('location')
          if (!location) break

          // Resolve relative URLs
          try {
            currentUrl = new URL(location, currentUrl).toString()
          } catch {
            break
          }

          redirectCount++
          response = await fetch(currentUrl, {
            ...fetchOptions,
            // Maintain method for 307/308, switch to GET for 301/302/303
            method: [307, 308].includes(response.status) ? input.method : 'GET',
            body: [307, 308].includes(response.status) ? fetchOptions.body : undefined,
          })
        }

        if (response.status >= 300 && response.status < 400 && redirectCount >= MAX_REDIRECTS) {
          clearTimeout(timeout)
          context.abortController.signal.removeEventListener('abort', onParentAbort)
          return {
            data: {
              url: input.url,
              method: input.method,
              status: response.status,
              statusText: 'Too Many Redirects',
              headers: {},
              body: `Exceeded maximum redirects (${MAX_REDIRECTS})`,
              bodyBytes: 0,
              durationMs: Date.now() - startTime,
              redirected: true,
              finalUrl: currentUrl,
              error: `Too many redirects (${MAX_REDIRECTS})`,
            } as HttpRequestOutput,
          }
        }
      }

      clearTimeout(timeout)
      context.abortController.signal.removeEventListener('abort', onParentAbort)
      const durationMs = Date.now() - startTime

      // Read response body
      const buffer = await response.arrayBuffer()
      const bodyBytes = buffer.byteLength

      if (bodyBytes > MAX_RESPONSE_SIZE) {
        return {
          data: {
            url: input.url,
            method: input.method,
            status: response.status,
            statusText: response.statusText,
            headers: extractResponseHeaders(response),
            body: `Response too large: ${bodyBytes.toLocaleString()} bytes (max ${MAX_RESPONSE_SIZE.toLocaleString()})`,
            bodyBytes,
            durationMs,
            redirected: redirectCount > 0,
            finalUrl: response.url || currentUrl,
            error: null,
          } as HttpRequestOutput,
        }
      }

      // Format response body
      const contentType = response.headers.get('content-type') || ''
      const { text: bodyText } = formatResponseBody(buffer, contentType)

      // Truncate if needed
      let finalBody = bodyText
      if (finalBody.length > MAX_RESPONSE_TEXT) {
        finalBody = finalBody.slice(0, MAX_RESPONSE_TEXT) +
          `\n\n... (truncated at ${MAX_RESPONSE_TEXT.toLocaleString()} chars, total ${bodyBytes.toLocaleString()} bytes)`
      }

      return {
        data: {
          url: input.url,
          method: input.method,
          status: response.status,
          statusText: response.statusText,
          headers: extractResponseHeaders(response),
          body: finalBody,
          bodyBytes,
          durationMs,
          redirected: redirectCount > 0,
          finalUrl: response.url || currentUrl,
          error: null,
        } as HttpRequestOutput,
      }
    } catch (err: unknown) {
      clearTimeout(timeout)
      context.abortController.signal.removeEventListener('abort', onParentAbort)
      const durationMs = Date.now() - startTime
      const error = err instanceof Error ? err : new Error(String(err))

      let message: string
      if (error.name === 'AbortError') {
        const reason = abortController.signal.reason
        if (reason === 'timeout') {
          message = `Request timed out after ${timeoutMs / 1000}s`
        } else if (reason === 'parent_abort') {
          message = 'Request cancelled'
        } else {
          message = `Request aborted: ${reason ?? 'unknown'}`
        }
      } else if (error.message.includes('ECONNREFUSED')) {
        message = `Connection refused: ${input.url}`
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        message = `DNS lookup failed: could not resolve host for ${input.url}`
      } else if (error.message.includes('ECONNRESET')) {
        message = `Connection reset by server: ${input.url}`
      } else if (error.message.includes('ETIMEDOUT')) {
        message = `Connection timed out: ${input.url}`
      } else if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
        message = `SSL/TLS error: ${error.message}`
      } else {
        message = `Request error: ${error.message}`
      }

      return {
        data: {
          url: input.url,
          method: input.method,
          status: 0,
          statusText: 'Error',
          headers: {},
          body: message,
          bodyBytes: 0,
          durationMs,
          redirected: false,
          finalUrl: input.url,
          error: message,
        } as HttpRequestOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: HttpRequestOutput, toolUseID: string) {
    const isError = data.error !== null || data.status >= 400 || data.status === 0
    const parts: string[] = []

    // Status line
    if (data.error) {
      parts.push(`Error: ${data.error}`)
    } else {
      parts.push(`${data.method} ${data.finalUrl} → ${data.status} ${data.statusText} (${data.durationMs}ms)`)
    }

    // Redirect info
    if (data.redirected && data.finalUrl !== data.url) {
      parts.push(`Redirected from: ${data.url}`)
    }

    // Response headers (selected useful ones)
    const usefulHeaders = ['content-type', 'content-length', 'location', 'x-request-id',
      'x-ratelimit-remaining', 'retry-after', 'www-authenticate', 'etag', 'last-modified']
    const headerLines: string[] = []
    for (const key of usefulHeaders) {
      if (data.headers[key]) {
        headerLines.push(`  ${key}: ${data.headers[key]}`)
      }
    }
    if (headerLines.length > 0) {
      parts.push('Response headers:')
      parts.push(...headerLines)
    }

    // Body
    if (data.body && !data.error) {
      parts.push('')
      parts.push(data.body)
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: parts.join('\n'),
      is_error: isError,
    }
  },
})

// ============================================================================
// Helpers
// ============================================================================

function extractResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })
  return headers
}

export { HTTP_REQUEST_TOOL_NAME }
