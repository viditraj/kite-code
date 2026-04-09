/**
 * MCP Marketplace client — scrapes mcpservers.org for server/skill listings.
 *
 * Since mcpservers.org does not expose a public API, we fetch HTML pages and
 * parse them with lightweight regex-based extraction. This avoids pulling in
 * heavy DOM-parsing dependencies while remaining accurate enough for the
 * structured card-based layout the site uses.
 *
 * All network calls use native Node.js fetch (Node 18+).
 */

import type {
  MarketplaceServer,
  MarketplaceServerDetail,
  MarketplaceSkill,
  MarketplaceCategory,
  MarketplaceSearchOptions,
  MCPInstallConfig,
} from './types.js'

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = 'https://mcpservers.org'
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'Kite/1.0 (MCP Marketplace Client)'

// ============================================================================
// Internal fetch helper
// ============================================================================

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText} fetching ${url}`)
    }
    return await resp.text()
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// HTML entity decoding
// ============================================================================

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '-',
  '&mdash;': '-',
  '&hellip;': '...',
  '&laquo;': '"',
  '&raquo;': '"',
}

/**
 * Decode HTML entities (named + numeric) to plain text.
 */
function decodeEntities(html: string): string {
  let result = html
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    result = result.replaceAll(entity, char)
  }
  // Hex entities: &#x27; &#x2F; etc.
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
  // Decimal entities: &#39; &#160; etc.
  result = result.replace(/&#(\d+);/g, (_m, dec: string) =>
    String.fromCharCode(parseInt(dec, 10)),
  )
  return result
}

/**
 * Strip HTML tags and decode entities to get clean text.
 */
function stripHtml(html: string): string {
  return decodeEntities(
    html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
  ).trim()
}

// ============================================================================
// HTML Parsing helpers
// ============================================================================

/**
 * Parse server cards from a listing page.
 *
 * The page uses card-style <a> links to /servers/owner/repo with the
 * server name in an <h3> or heading element and description in a <p>.
 * Some cards have badge text ("official", "sponsor") in <span> elements.
 */
function parseServerCards(html: string): MarketplaceServer[] {
  const servers: MarketplaceServer[] = []
  const seen = new Set<string>()

  const cardRegex = /<a[^>]+href="(\/servers\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = cardRegex.exec(html)) !== null) {
    const path = match[1]!
    const content = match[2]!

    if (seen.has(path)) continue
    seen.add(path)

    // Detect badges from raw HTML before stripping tags
    const isOfficial = /\bofficial\b/i.test(content)
    const isSponsor = /\bsponsor\b/i.test(content)

    // Skip sponsor entries (ads) — they link to external sites anyway
    if (isSponsor) continue

    // Try structured extraction: look for heading + paragraph
    const headingMatch = content.match(/<(?:h[1-6]|strong)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong)>/i)
    const paraMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i)

    let name: string
    let description: string

    if (headingMatch) {
      // Structured: heading for name, paragraph for description
      name = stripHtml(headingMatch[1]!)
      description = paraMatch ? stripHtml(paraMatch[1]!) : ''
    } else {
      // Fallback: split all text on double-space or take first chunk as name
      const textContent = stripHtml(content)
      if (!textContent) continue
      const parts = textContent.split(/\s{2,}/)
      name = parts[0]?.trim() ?? ''
      description = parts.slice(1).join(' ').trim()
    }

    // Clean badge words out of the name itself
    name = name.replace(/\b(official|sponsor)\b/gi, '').replace(/\s+/g, ' ').trim()
    description = description.replace(/^(official|sponsor)\s*/gi, '').trim()

    if (!name || name.length < 2) continue

    servers.push({ name, description, path, isOfficial, isSponsor: false })
  }

  return servers
}

/**
 * Parse skill cards from the agent-skills page.
 */
function parseSkillCards(html: string): MarketplaceSkill[] {
  const skills: MarketplaceSkill[] = []
  const seen = new Set<string>()

  const cardRegex = /<a[^>]+href="(\/skills\/[^"]*|https:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = cardRegex.exec(html)) !== null) {
    const path = match[1]!
    const content = match[2]!

    if (seen.has(path)) continue
    seen.add(path)

    const textContent = stripHtml(content)
    if (!textContent || textContent.length < 5) continue

    // Try to extract "Name by Author Description"
    const byMatch = textContent.match(/^(.+?)\s+by\s+(\S+)\s+([\s\S]*)$/i)
    if (byMatch) {
      skills.push({
        name: byMatch[1]!.trim(),
        author: byMatch[2]!.trim(),
        description: byMatch[3]!.trim(),
        path,
      })
    } else {
      const parts = textContent.split(/\s{2,}/)
      skills.push({
        name: parts[0]?.trim() ?? textContent.slice(0, 60),
        author: 'unknown',
        description: parts.slice(1).join(' ').trim(),
        path,
      })
    }
  }

  return skills
}

/**
 * Extract the standard MCP config JSON from a server detail page.
 *
 * Detail pages contain JSON code blocks with the standard config format:
 * ```
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": ["@package/name@latest"]
 *     }
 *   }
 * }
 * ```
 */
function extractStandardConfig(html: string): MCPInstallConfig | undefined {
  const codeBlockRegex = /<(?:code|pre)[^>]*>([\s\S]*?)<\/(?:code|pre)>/gi
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(html)) !== null) {
    const content = decodeEntities(match[1]!.replace(/<[^>]+>/g, '')).trim()

    if (!content.includes('"mcpServers"')) continue

    try {
      const parsed = JSON.parse(content)
      if (parsed?.mcpServers && typeof parsed.mcpServers === 'object') {
        const entries = Object.entries(parsed.mcpServers)
        if (entries.length > 0) {
          const [serverName, config] = entries[0]!
          const cfg = config as Record<string, unknown>
          return {
            serverName: serverName!,
            config: {
              command: cfg.command as string ?? 'npx',
              args: cfg.args as string[] | undefined,
              env: cfg.env as Record<string, string> | undefined,
              type: cfg.type as 'stdio' | 'sse' | 'http' | undefined,
              url: cfg.url as string | undefined,
              headers: cfg.headers as Record<string, string> | undefined,
            },
          }
        }
      }
    } catch {
      // Not valid JSON, try next block
    }
  }

  return undefined
}

/**
 * Extract GitHub URL from a detail page.
 */
function extractGitHubUrl(html: string): string | undefined {
  const ghMatch = html.match(/href="(https:\/\/github\.com\/[^"]+)"/i)
  return ghMatch?.[1]
}

/**
 * Extract NPM package name from the config args.
 */
function extractNpmPackage(config: MCPInstallConfig | undefined): string | undefined {
  if (!config?.config.args) return undefined
  for (const arg of config.config.args) {
    const npmMatch = arg.match(/^(@?[a-z0-9][\w./-]*)(@[^\s]+)?$/i)
    if (npmMatch) return npmMatch[1]
  }
  return undefined
}

/**
 * Extract long description from detail page.
 */
function extractLongDescription(html: string): string {
  const descBlocks: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let match: RegExpExecArray | null
  let count = 0

  while ((match = pRegex.exec(html)) !== null && count < 5) {
    const text = stripHtml(match[1]!)
    if (text.length > 20) {
      descBlocks.push(text)
      count++
    }
  }

  return descBlocks.join('\n\n')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Browse MCP servers from mcpservers.org with optional category and sort.
 */
export async function browseServers(
  options: MarketplaceSearchOptions = {},
): Promise<{ servers: MarketplaceServer[]; totalCount: number }> {
  const { category, sort = 'name', page = 1, officialOnly = false } = options

  let url: string
  if (officialOnly) {
    url = `${BASE_URL}/official`
  } else if (category) {
    url = `${BASE_URL}/category/${category}?sort=${sort}&page=${page}`
  } else {
    url = `${BASE_URL}/all?sort=${sort}&page=${page}`
  }

  const html = await fetchPage(url)
  let servers = parseServerCards(html)

  // Extract total count from "Showing 1-30 of XXXX servers"
  const countMatch = html.match(/of\s+([\d,]+)\s+servers/i)
  const totalCount = countMatch ? parseInt(countMatch[1]!.replace(/,/g, ''), 10) : servers.length

  if (category) {
    servers = servers.map(s => ({ ...s, category }))
  }

  return { servers, totalCount }
}

/**
 * Search for MCP servers by keyword.
 *
 * Since mcpservers.org doesn't have a search API, we fetch the full listing
 * and filter client-side.
 */
export async function searchServers(
  query: string,
  options: { category?: MarketplaceCategory; maxResults?: number } = {},
): Promise<MarketplaceServer[]> {
  const { category, maxResults = 20 } = options
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0)

  const { servers } = await browseServers({ category, sort: 'name', page: 1 })

  const scored = servers
    .map(server => {
      const nameLower = server.name.toLowerCase()
      const descLower = server.description.toLowerCase()
      let score = 0

      for (const term of queryTerms) {
        if (nameLower.includes(term)) score += 10
        if (nameLower === queryLower) score += 20
        if (descLower.includes(term)) score += 5
      }

      if (server.isOfficial) score += 3

      return { server, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ server }) => server)

  return scored
}

/**
 * Get detailed information about a specific MCP server.
 */
export async function getServerDetail(
  serverPath: string,
): Promise<MarketplaceServerDetail> {
  const path = serverPath.startsWith('/') ? serverPath : `/servers/${serverPath}`
  const url = `${BASE_URL}${path}`

  const html = await fetchPage(url)

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const name = titleMatch
    ? stripHtml(titleMatch[1]!)
    : path.split('/').pop() ?? 'Unknown'

  const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
  const shortDesc = metaDesc ? decodeEntities(metaDesc[1]!) : ''

  const githubUrl = extractGitHubUrl(html)
  const standardConfig = extractStandardConfig(html)
  const npmPackage = extractNpmPackage(standardConfig)
  const longDescription = extractLongDescription(html)

  return {
    name,
    description: shortDesc || longDescription.slice(0, 200),
    path,
    isOfficial: /\bofficial\b/i.test(html.slice(0, 5000)),
    isSponsor: false,
    githubUrl,
    longDescription,
    standardConfig,
    npmPackage,
  }
}

/**
 * Browse agent skills from mcpservers.org/agent-skills.
 */
export async function browseSkills(): Promise<MarketplaceSkill[]> {
  const url = `${BASE_URL}/agent-skills`
  const html = await fetchPage(url)
  return parseSkillCards(html)
}

/**
 * Get available marketplace categories.
 */
export function getCategories(): Array<{ id: MarketplaceCategory; label: string }> {
  return [
    { id: 'search', label: 'Search' },
    { id: 'web-scraping', label: 'Web Scraping' },
    { id: 'communication', label: 'Communication' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'development', label: 'Development' },
    { id: 'database', label: 'Database' },
    { id: 'cloud-service', label: 'Cloud Service' },
    { id: 'file-system', label: 'File System' },
    { id: 'cloud-storage', label: 'Cloud Storage' },
    { id: 'version-control', label: 'Version Control' },
    { id: 'other', label: 'Other' },
  ]
}
