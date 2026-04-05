/**
 * ToolSearchTool — Search for deferred tools by keyword or direct selection.
 *
 * Implements the same patterns as Claude Code's ToolSearchTool:
 * - select: prefix for direct tool selection
 * - Keyword-based scoring (name parts, searchHint, description)
 * - Required terms with + prefix
 * - MCP tool name parsing (mcp__server__action)
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { Tool, Tools, ToolUseContext } from '../../Tool.js'

// ============================================================================
// Constants
// ============================================================================

export const TOOL_SEARCH_TOOL_NAME = 'ToolSearch'

// Scoring weights
const NAME_SCORE_MCP = 12
const NAME_SCORE_REGULAR = 10
const HINT_SCORE = 4
const DESC_SCORE = 2

// ============================================================================
// Schema
// ============================================================================

const inputSchema = z.strictObject({
  query: z.string().describe(
    'Query to find deferred tools. Use "select:<tool_name>" for direct selection, or keywords to search.',
  ),
  max_results: z.number().optional().default(5).describe(
    'Maximum number of results to return (default: 5)',
  ),
})

type ToolSearchInput = z.infer<typeof inputSchema>

interface ToolSearchOutput {
  matches: string[]
  query: string
  total_deferred_tools: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a tool is deferred (should be loaded on demand).
 */
export function isDeferredTool(tool: Tool): boolean {
  if (tool.alwaysLoad) return false
  return tool.shouldDefer === true || tool.isMcp === true
}

/**
 * Parse a tool name into searchable parts.
 * MCP tools: mcp__server__action → ['server', 'action']
 * CamelCase tools: FileRead → ['File', 'Read']
 */
function parseToolName(name: string): string[] {
  // MCP tool naming: mcp__serverName__toolName
  if (name.startsWith('mcp__')) {
    return name.split('__').slice(1)
  }
  // CamelCase splitting
  return name.split(/(?=[A-Z])/).filter(Boolean)
}

/**
 * Score a tool against search terms.
 */
function scoreToolForSearch(
  tool: Tool,
  terms: string[],
  requiredTerms: Set<string>,
): number {
  const nameParts = parseToolName(tool.name).map(p => p.toLowerCase())
  const hint = (tool.searchHint ?? '').toLowerCase()
  const isMcp = tool.isMcp ?? false

  let score = 0
  let hasAllRequired = true

  for (const term of requiredTerms) {
    const lowerTerm = term.toLowerCase()
    const matchesName = nameParts.some(p => p.includes(lowerTerm))
    const matchesHint = hint.includes(lowerTerm)
    if (!matchesName && !matchesHint) {
      hasAllRequired = false
      break
    }
  }

  if (!hasAllRequired) return 0

  for (const term of terms) {
    const lowerTerm = term.toLowerCase()

    // Name match
    if (nameParts.some(p => p.includes(lowerTerm))) {
      score += isMcp ? NAME_SCORE_MCP : NAME_SCORE_REGULAR
    }

    // Search hint match
    if (hint.includes(lowerTerm)) {
      score += HINT_SCORE
    }

    // Description word boundary match (lower weight)
    // We'll check the tool name as a proxy since descriptions are async
    if (tool.name.toLowerCase().includes(lowerTerm)) {
      score += DESC_SCORE
    }
  }

  return score
}

// ============================================================================
// Tool definition
// ============================================================================

export const ToolSearchTool = buildTool({
  name: TOOL_SEARCH_TOOL_NAME,
  maxResultSizeChars: 100_000,
  strict: true,

  inputSchema,

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async description() {
    return 'Search for and load deferred tools by keyword or direct selection'
  },

  async prompt({ tools }) {
    const deferredTools = (tools as Tools).filter(isDeferredTool)
    const toolHints = deferredTools
      .slice(0, 20)
      .map(t => `  - ${t.name}${t.searchHint ? `: ${t.searchHint}` : ''}`)
      .join('\n')

    return `Search for deferred tools that aren't loaded by default.

Query formats:
- \`select:ToolName\` — directly select a tool by name (comma-separated for multiple)
- \`keyword search\` — find tools matching keywords
- \`+required optional\` — prefix terms with + to require them

Available deferred tools (${deferredTools.length} total):
${toolHints}${deferredTools.length > 20 ? `\n  ... and ${deferredTools.length - 20} more` : ''}`
  },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call({ query, max_results }: ToolSearchInput, context: ToolUseContext) {
    const allTools = context.options.tools
    const deferredTools = allTools.filter(isDeferredTool)

    // select: prefix — direct tool selection
    if (query.startsWith('select:')) {
      const names = query.slice(7).split(',').map(n => n.trim()).filter(Boolean)
      const matches: string[] = []

      for (const name of names) {
        const found = deferredTools.find(t => t.name === name) ??
          allTools.find(t => t.name === name)
        if (found) {
          matches.push(found.name)
        }
      }

      return {
        data: {
          matches,
          query,
          total_deferred_tools: deferredTools.length,
        },
      }
    }

    // Keyword search
    const rawTerms = query.split(/\s+/).filter(Boolean)
    const requiredTerms = new Set<string>()
    const allTerms: string[] = []

    for (const term of rawTerms) {
      if (term.startsWith('+')) {
        const t = term.slice(1)
        if (t) {
          requiredTerms.add(t)
          allTerms.push(t)
        }
      } else {
        allTerms.push(term)
      }
    }

    // Score and rank
    const scored = deferredTools
      .map(tool => ({
        name: tool.name,
        score: scoreToolForSearch(tool, allTerms, requiredTerms),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max_results)

    return {
      data: {
        matches: scored.map(s => s.name),
        query,
        total_deferred_tools: deferredTools.length,
      },
    }
  },

  mapToolResultToToolResultBlockParam(data: ToolSearchOutput, toolUseID: string) {
    if (data.matches.length === 0) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: `No matching deferred tools found for query: "${data.query}"`,
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Found ${data.matches.length} matching tool(s): ${data.matches.join(', ')}`,
    }
  },
})
