/**
 * SyntheticOutputTool — Format synthetic output for display.
 *
 * Takes content and an optional format, returns the content formatted
 * appropriately for display in the conversation.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'

const SYNTHETIC_OUTPUT_TOOL_NAME = 'SyntheticOutput'

const inputSchema = z.strictObject({
  content: z.string().describe('The content to format and display'),
  format: z.enum(['text', 'json', 'markdown']).optional().describe(
    'Output format: "text" (default), "json" (pretty-printed), or "markdown"'
  ),
})

type SyntheticOutputInput = z.infer<typeof inputSchema>

interface SyntheticOutputOutput {
  formatted: string
  format: string
  originalLength: number
}

function formatContent(content: string, format: string): string {
  switch (format) {
    case 'json': {
      try {
        const parsed = JSON.parse(content)
        return JSON.stringify(parsed, null, 2)
      } catch {
        // If not valid JSON, wrap in a JSON string
        return JSON.stringify({ output: content }, null, 2)
      }
    }
    case 'markdown': {
      // Ensure proper markdown formatting
      let result = content.trim()
      // If it doesn't start with a markdown element, no transformation needed
      return result
    }
    case 'text':
    default: {
      return content
    }
  }
}

export const SyntheticOutputTool = buildTool({
  name: SYNTHETIC_OUTPUT_TOOL_NAME,
  searchHint: 'format synthetic output display text json markdown',
  maxResultSizeChars: 100_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description({ format }: SyntheticOutputInput) {
    return `Format output as ${format || 'text'}`
  },

  async prompt() {
    return `Format synthetic output for display in the conversation.

Input:
- content: The content string to format
- format: (optional) One of "text", "json", or "markdown" (default: "text")

Format behaviors:
- "text": Returns content as-is
- "json": Pretty-prints JSON content with 2-space indentation. If content is not valid JSON, wraps it in a JSON object.
- "markdown": Returns content as markdown, ensuring proper formatting.

Use this tool when you need to present structured output to the user in a specific format.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'SyntheticOutput'
  },

  toAutoClassifierInput(input: SyntheticOutputInput) {
    return `synthetic output ${input.format || 'text'}`
  },

  getToolUseSummary(input?: Partial<SyntheticOutputInput>) {
    if (!input?.content) return null
    const fmt = input.format || 'text'
    const len = input.content.length
    return `Format ${len} chars as ${fmt}`
  },

  getActivityDescription(input?: Partial<SyntheticOutputInput>) {
    const fmt = input?.format || 'text'
    return `Formatting output as ${fmt}`
  },

  async validateInput(input: SyntheticOutputInput) {
    if (input.content === undefined || input.content === null) {
      return { result: false, message: 'Content is required', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: SyntheticOutputInput) {
    const format = input.format || 'text'
    const formatted = formatContent(input.content, format)

    return {
      data: {
        formatted,
        format,
        originalLength: input.content.length,
      } as SyntheticOutputOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: SyntheticOutputOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: content.formatted,
    }
  },
})

export { SYNTHETIC_OUTPUT_TOOL_NAME }
