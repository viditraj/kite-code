/**
 * WebFetchTool — Fetch content from URLs.
 *
 * Ported from Claude Code's WebFetchTool:
 * - HTTP GET with streaming response
 * - URL validation (scheme, credentials, hostname)
 * - HTTP→HTTPS upgrade
 * - Response size limits
 * - HTML→Markdown conversion via Turndown (not regex stripping)
 * - LRU cache with 15-minute TTL
 * - Redirect handling
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
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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

// ============================================================================
// URL validation
// ============================================================================

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

// ============================================================================
// HTML → Markdown conversion via Turndown
// ============================================================================

let turndownInstance: any = null

async function htmlToMarkdown(html: string): Promise<string> {
  if (!turndownInstance) {
    try {
      const TurndownService = (await import('turndown')).default
      turndownInstance = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
      })
      // Remove script and style content
      turndownInstance.remove(['script', 'style', 'noscript', 'iframe', 'svg'])
    } catch {
      // Turndown not available — fall back to regex stripping
      return stripHtmlFallback(html)
    }
  }

  try {
    return turndownInstance.turndown(html)
  } catch {
    return stripHtmlFallback(html)
  }
}

/** Regex fallback when Turndown is unavailable */
function stripHtmlFallback(html: string): string {
  let text = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  return text
}

// ============================================================================
// URL cache (LRU with TTL)
// ============================================================================

interface CacheEntry {
  result: string
  bytes: number
  code: number
  codeText: string
  fetchedAt: number
}

const urlCache = new Map<string, CacheEntry>()
let cacheSize = 0

function getCached(url: string): CacheEntry | null {
  const entry = urlCache.get(url)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    urlCache.delete(url)
    cacheSize -= entry.result.length
    return null
  }
  return entry
}

function setCache(url: string, entry: CacheEntry): void {
  // Evict oldest entries if over size limit
  while (cacheSize + entry.result.length > MAX_CACHE_SIZE && urlCache.size > 0) {
    const oldest = urlCache.keys().next().value
    if (oldest) {
      const old = urlCache.get(oldest)
      if (old) cacheSize -= old.result.length
      urlCache.delete(oldest)
    }
  }
  urlCache.set(url, entry)
  cacheSize += entry.result.length
}

// ============================================================================
// Tool definition
// ============================================================================

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
HTML content is converted to clean Markdown with proper formatting preserved.
Results are cached for 15 minutes.
Response content is limited to ${MAX_TEXT_LENGTH.toLocaleString()} characters.

Note: URLs requiring authentication (Google Docs, Confluence, Jira, private repos) will not work.`
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

    // Check cache first
    const cached = getCached(url)
    if (cached) {
      return {
        data: {
          url,
          bytes: cached.bytes,
          code: cached.code,
          codeText: cached.codeText,
          result: cached.result,
          durationMs: Date.now() - startTime,
        },
      }
    }

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS)

    // Also abort if the parent context aborts
    const onParentAbort = () => abortController.abort()
    context.abortController.signal.addEventListener('abort', onParentAbort)

    try {
      const response = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'Accept': 'text/html, text/markdown, application/json, text/plain, */*',
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })

      clearTimeout(timeout)
      context.abortController.signal.removeEventListener('abort', onParentAbort)
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

      let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)

      // Convert HTML to Markdown
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html') || (text.trim().startsWith('<') && text.includes('</html>'))) {
        text = await htmlToMarkdown(text)
      }

      // Truncate
      if (text.length > MAX_TEXT_LENGTH) {
        text = text.slice(0, MAX_TEXT_LENGTH) + `\n\n... (truncated at ${MAX_TEXT_LENGTH.toLocaleString()} chars)`
      }

      // Cache the result
      setCache(url, {
        result: text,
        bytes,
        code: response.status,
        codeText: response.statusText,
        fetchedAt: Date.now(),
      })

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
      context.abortController.signal.removeEventListener('abort', onParentAbort)
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
