/**
 * WebFetchTool — Fetch content from URLs.
 *
 * Implements the same patterns as Claude Code's WebFetchTool.ts:
 * - HTTP GET with streaming response
 * - URL validation (scheme, credentials, hostname)
 * - HTTP→HTTPS upgrade
 * - Response size limits
 * - Basic HTML→text conversion
 * - Always read-only, concurrency-safe, deferred
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const WEB_FETCH_TOOL_NAME = 'WebFetch'
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024 // 10MB
const MAX_TEXT_LENGTH = 100_000 // chars
const FETCH_TIMEOUT_MS = 60_000
const MAX_URL_LENGTH = 2000

const inputSchema = z.strictObject({
  url: z.string().url().describe('The URL to fetch content from'),
  prompt: z.string().describe('The prompt describing what information to extract from the page'),
})

type WebFetchInput = z.infer<typeof inputSchema>

interface WebFetchOutput {
  url: string
  bytes: number
  code: number
  codeText: string
  result: string
  durationMs: number
}

function validateUrl(url: string): string | null {
  if (url.length > MAX_URL_LENGTH) {
    return `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `Unsupported scheme: ${parsed.protocol}`
    }
    if (parsed.username || parsed.password) {
      return 'URLs with embedded credentials are not allowed'
    }
    const parts = parsed.hostname.split('.')
    if (parts.length < 2 || parts.some(p => !p)) {
      return `Invalid hostname: ${parsed.hostname}`
    }
    return null
  } catch {
    return `Invalid URL: ${url}`
  }
}

function upgradeToHttps(url: string): string {
  if (url.startsWith('http://')) {
    return 'https://' + url.slice(7)
  }
  return url
}

function stripHtmlTags(html: string): string {
  // Remove script and style tags with content
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  return text
}

export const WebFetchTool = buildTool({
  name: WEB_FETCH_TOOL_NAME,
  searchHint: 'fetch and extract content from a URL',
  maxResultSizeChars: 100_000,
  shouldDefer: true,

  inputSchema,

  async description() {
    return 'Fetch content from a URL and extract information'
  },

  async prompt() {
    return `Fetch content from a URL. Use this to read web pages, documentation, API responses, and other online content.

The URL must be a valid HTTP/HTTPS URL. HTTP URLs are automatically upgraded to HTTPS.
The prompt parameter describes what information to extract from the page.
Response content is limited to ${MAX_TEXT_LENGTH} characters.`
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return true
  },

  toAutoClassifierInput(input: WebFetchInput) {
    return input.url
  },

  userFacingName() {
    return 'WebFetch'
  },

  getToolUseSummary(input?: Partial<WebFetchInput>) {
    if (!input?.url) return null
    return input.url.length > 80 ? input.url.slice(0, 80) + '...' : input.url
  },

  getActivityDescription(input?: Partial<WebFetchInput>) {
    if (!input?.url) return 'Fetching URL'
    const display = input.url.length > 60 ? input.url.slice(0, 60) + '...' : input.url
    return `Fetching ${display}`
  },

  async validateInput(input: WebFetchInput) {
    const error = validateUrl(input.url)
    if (error) {
      return { result: false, message: error, errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: WebFetchInput, context: ToolUseContext) {
    const url = upgradeToHttps(input.url)
    const startTime = Date.now()

    const timeout = setTimeout(() => context.abortController.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        signal: context.abortController.signal,
        headers: {
          'Accept': 'text/markdown, text/html, */*',
          'User-Agent': 'Kite/1.0 (AI Coding Assistant)',
        },
        redirect: 'follow',
      })

      clearTimeout(timeout)
      const durationMs = Date.now() - startTime

      if (!response.ok) {
        return {
          data: {
            url: response.url || url,
            bytes: 0,
            code: response.status,
            codeText: response.statusText,
            result: `HTTP Error: ${response.status} ${response.statusText}`,
            durationMs,
          },
        }
      }

      const buffer = await response.arrayBuffer()
      const bytes = buffer.byteLength

      if (bytes > MAX_CONTENT_LENGTH) {
        return {
          data: {
            url: response.url || url,
            bytes,
            code: response.status,
            codeText: response.statusText,
            result: `Response too large: ${bytes.toLocaleString()} bytes (max ${MAX_CONTENT_LENGTH.toLocaleString()})`,
            durationMs,
          },
        }
      }

      let text = new TextDecoder().decode(buffer)

      // Strip HTML if it looks like HTML
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html') && text.trim().startsWith('<')) {
        text = stripHtmlTags(text)
      }

      // Truncate
      if (text.length > MAX_TEXT_LENGTH) {
        text = text.slice(0, MAX_TEXT_LENGTH) + `\n\n... (truncated at ${MAX_TEXT_LENGTH.toLocaleString()} chars)`
      }

      return {
        data: {
          url: response.url || url,
          bytes,
          code: response.status,
          codeText: response.statusText,
          result: text,
          durationMs,
        },
      }
    } catch (err: unknown) {
      clearTimeout(timeout)
      const durationMs = Date.now() - startTime
      const error = err instanceof Error ? err : new Error(String(err))
      const message = error.name === 'AbortError'
        ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : `Fetch error: ${error.message}`

      return {
        data: {
          url,
          bytes: 0,
          code: 0,
          codeText: 'Error',
          result: message,
          durationMs,
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: WebFetchOutput, toolUseID: string) {
    const isError = data.code >= 400 || data.code === 0
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: data.result,
      is_error: isError,
    }
  },
})

export { WEB_FETCH_TOOL_NAME }
