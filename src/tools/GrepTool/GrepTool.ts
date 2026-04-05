/**
 * GrepTool — Search file contents with regex (ripgrep).
 *
 * Implements the same patterns as Claude Code's GrepTool.ts:
 * - Uses ripgrep (rg) with fallback to grep
 * - Multiple output modes: content, files_with_matches, count
 * - Context lines (-A, -B, -C), case insensitive (-i)
 * - Always read-only, always concurrency-safe
 */

import { z } from 'zod'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'

const GREP_TOOL_NAME = 'Grep'
const DEFAULT_HEAD_LIMIT = 100

const inputSchema = z.strictObject({
  pattern: z.string().describe('The regular expression pattern to search for in file contents'),
  path: z.string().optional().describe('File or directory to search in. Defaults to current working directory.'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}")'),
  output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().describe(
    'Output mode: "content" shows matching lines, "files_with_matches" shows file paths, "count" shows match counts. Defaults to "files_with_matches".'
  ),
  context: z.number().optional().describe('Number of context lines before and after each match (rg -C)'),
  '-i': z.boolean().optional().describe('Case insensitive search (rg -i)'),
  '-n': z.boolean().optional().describe('Show line numbers (rg -n). Defaults to true for content mode.'),
  head_limit: z.number().optional().describe('Limit output to first N lines/entries'),
})

type GrepInput = z.infer<typeof inputSchema>

interface GrepOutput {
  matches: string
  matchCount: number
}

export const GrepTool = buildTool({
  name: GREP_TOOL_NAME,
  searchHint: 'search file contents with regex (ripgrep)',
  maxResultSizeChars: 20_000,
  strict: true,

  inputSchema,

  async description() {
    return 'Search for patterns in file contents using regular expressions'
  },

  async prompt() {
    return `Search for patterns in file contents using regular expressions (ripgrep).

Use this instead of grep or rg via Bash. Supports:
- Regular expressions
- Glob patterns to filter files
- Context lines around matches
- Case-insensitive search
- Multiple output modes (content, files_with_matches, count)`
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return true
  },

  async checkPermissions() {
    return { behavior: 'allow' as const }
  },

  isSearchOrReadCommand() {
    return { isSearch: true, isRead: false }
  },

  toAutoClassifierInput(input: GrepInput) {
    return `grep ${input.pattern} ${input.path || '.'}`
  },

  userFacingName() {
    return 'Grep'
  },

  getToolUseSummary(input?: Partial<GrepInput>) {
    if (!input?.pattern) return null
    return `pattern="${input.pattern}"`
  },

  getActivityDescription(input?: Partial<GrepInput>) {
    if (!input?.pattern) return 'Searching'
    return `Searching for "${input.pattern}"`
  },

  async call(input: GrepInput, context: any, _canUseTool?: any, _parentMessage?: any) {
    const cwd = context.getCwd()
    const searchPath = input.path ? resolve(cwd, input.path) : cwd
    const mode = input.output_mode || 'files_with_matches'
    const headLimit = input.head_limit || DEFAULT_HEAD_LIMIT

    // Build ripgrep command
    const args: string[] = ['rg', '--no-heading', '--color=never']

    if (mode === 'files_with_matches') {
      args.push('-l')
    } else if (mode === 'count') {
      args.push('-c')
    } else {
      // content mode
      args.push('--line-number')
    }

    if (input['-i']) args.push('-i')
    if (input.context) args.push(`-C${input.context}`)
    if (input.glob) args.push(`--glob=${input.glob}`)

    args.push(`--max-count=${headLimit}`)
    args.push('--', input.pattern, searchPath)

    try {
      const output = execSync(args.join(' '), {
        encoding: 'utf-8',
        cwd,
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const lines = output.trim().split('\n').filter(Boolean)
      const truncated = lines.length > headLimit
        ? lines.slice(0, headLimit).join('\n') + `\n... (${lines.length} total matches, showing first ${headLimit})`
        : lines.join('\n')

      return {
        data: {
          matches: truncated || 'No matches found.',
          matchCount: lines.length,
        },
      }
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string; stderr?: string }
      // rg exits with 1 when no matches, 2 for errors
      if (e.status === 1) {
        return { data: { matches: 'No matches found.', matchCount: 0 } }
      }
      // Try grep fallback
      try {
        const grepArgs = ['grep', '-rn', '--color=never']
        if (input['-i']) grepArgs.push('-i')
        if (input.glob) grepArgs.push(`--include=${input.glob}`)
        grepArgs.push('--', input.pattern, searchPath)

        const output = execSync(grepArgs.join(' '), {
          encoding: 'utf-8',
          cwd,
          timeout: 30_000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        const lines = output.trim().split('\n').filter(Boolean).slice(0, headLimit)
        return { data: { matches: lines.join('\n') || 'No matches found.', matchCount: lines.length } }
      } catch {
        return { data: { matches: 'No matches found.', matchCount: 0 } }
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: GrepOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: data.matches,
    }
  },
})

export { GREP_TOOL_NAME }
