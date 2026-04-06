/**
 * REPLTool — Batch tool execution mode.
 *
 * Based on Claude Code's REPLTool.
 * When REPL mode is enabled, primitive tools (Read, Write, Edit, Bash,
 * Grep, Glob, Agent, NotebookEdit) are hidden from direct model use.
 * The model must use them through this REPL tool, which batches
 * operations and reduces context pollution.
 *
 * Activation:
 *   KITE_REPL=1 environment variable, or /repl-mode command
 *
 * The REPL tool accepts a script (sequence of tool calls) and executes
 * them in order, returning combined results.
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { Tool, ToolUseContext } from '../../Tool.js'
import { findToolByName } from '../../Tool.js'

// ============================================================================
// Constants
// ============================================================================

export const REPL_TOOL_NAME = 'REPL'

/** Tools that are hidden from direct model access when REPL mode is active */
export const REPL_ONLY_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Grep',
  'Glob',
  'NotebookEdit',
  'Agent',
])

// ============================================================================
// REPL mode check
// ============================================================================

/**
 * Check if REPL mode is enabled.
 * Controlled by KITE_REPL environment variable.
 */
export function isReplModeEnabled(): boolean {
  const val = process.env.KITE_REPL
  if (val === '0' || val === 'false') return false
  if (val === '1' || val === 'true') return true
  return false // Default: disabled
}

/**
 * Get the list of primitive tools that are accessible inside the REPL.
 * These tools are hidden from direct model use but available through REPL.
 */
export function getReplPrimitiveToolNames(): string[] {
  return Array.from(REPL_ONLY_TOOLS)
}

/**
 * Filter tools based on REPL mode.
 * When REPL mode is active and the REPL tool is present, hide primitive tools
 * from the model's visible tool pool.
 */
export function filterToolsForReplMode(tools: Tool[]): Tool[] {
  if (!isReplModeEnabled()) return tools

  const hasRepl = tools.some(t => t.name === REPL_TOOL_NAME)
  if (!hasRepl) return tools

  return tools.filter(t => !REPL_ONLY_TOOLS.has(t.name))
}

// ============================================================================
// Schema
// ============================================================================

const stepSchema = z.object({
  tool: z.string().describe('Tool name to call (Read, Write, Edit, Bash, Grep, Glob, etc.)'),
  input: z.record(z.unknown()).describe('Input parameters for the tool'),
}).passthrough()

const inputSchema = z.object({
  steps: z.preprocess(
    (val) => {
      // If model sends a single step object instead of array, wrap it
      if (val && typeof val === 'object' && !Array.isArray(val) && 'tool' in (val as any)) {
        return [val]
      }
      return val
    },
    z.array(stepSchema).min(1).describe(
      'Sequence of tool calls to execute in order. Each step specifies a tool name and its input parameters.',
    ),
  ),
  description: z.string().optional().describe('Brief description of what this batch does'),
}).passthrough()

type REPLInput = z.infer<typeof inputSchema>

interface StepResult {
  tool: string
  success: boolean
  output: string
}

interface REPLOutput {
  description?: string
  steps: StepResult[]
  totalSteps: number
  successCount: number
  failCount: number
}

// ============================================================================
// Tool
// ============================================================================

export const REPLTool = buildTool({
  name: REPL_TOOL_NAME,
  searchHint: 'execute multiple tool calls in a batch',
  maxResultSizeChars: 200_000,
  strict: false,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => false,

  async description(input: REPLInput) {
    return input.description ?? `Execute ${input.steps.length} tool steps`
  },

  async prompt() {
    const toolList = Array.from(REPL_ONLY_TOOLS).join(', ')
    return `Execute a batch of tool operations in sequence. Use this to perform multiple file reads, writes, searches, and shell commands in a single call.

Available tools in REPL: ${toolList}

Each step specifies:
- tool: The tool name (e.g., "Read", "Bash", "Grep")
- input: The parameters for that tool (same as calling it directly)

Steps execute sequentially. If a step fails, subsequent steps still execute.

Example:
{
  "description": "Read config and run tests",
  "steps": [
    { "tool": "Read", "input": { "file_path": "package.json" } },
    { "tool": "Bash", "input": { "command": "npm test" } }
  ]
}`
  },

  async call(input: REPLInput, context: ToolUseContext) {
    const results: StepResult[] = []
    let successCount = 0
    let failCount = 0

    const allTools = context.options.tools ?? []

    for (const step of input.steps) {
      // Find the tool
      const tool = findToolByName(allTools, step.tool)

      if (!tool) {
        results.push({
          tool: step.tool,
          success: false,
          output: `<tool_use_error>Unknown tool: ${step.tool}. Available: ${Array.from(REPL_ONLY_TOOLS).join(', ')}</tool_use_error>`,
        })
        failCount++
        continue
      }

      // Validate it's an allowed REPL tool
      if (!REPL_ONLY_TOOLS.has(step.tool) && !step.tool.startsWith('mcp__')) {
        results.push({
          tool: step.tool,
          success: false,
          output: `<tool_use_error>Tool "${step.tool}" is not available in REPL mode. Use it directly instead.</tool_use_error>`,
        })
        failCount++
        continue
      }

      try {
        // Parse input through the tool's schema
        const parsed = tool.inputSchema.safeParse(step.input)
        if (!parsed.success) {
          results.push({
            tool: step.tool,
            success: false,
            output: `<tool_use_error>Input validation error: ${parsed.error.message}</tool_use_error>`,
          })
          failCount++
          continue
        }

        // Execute the tool
        const dummyCanUse = async () => ({ behavior: 'allow' as const })
        const result = await tool.call(parsed.data, context, dummyCanUse as any, null)
        const data = result.data

        // Extract text output from the result
        let output: string
        if (typeof data === 'string') {
          output = data
        } else if (data && typeof data === 'object') {
          // Use mapToolResultToToolResultBlockParam if available
          if (tool.mapToolResultToToolResultBlockParam) {
            const block = tool.mapToolResultToToolResultBlockParam(data, 'repl-step')
            output = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          } else if ('content' in data) {
            output = String((data as any).content)
          } else if ('stdout' in data) {
            output = String((data as any).stdout)
          } else if ('result' in data) {
            output = String((data as any).result)
          } else {
            output = JSON.stringify(data)
          }
        } else {
          output = String(data)
        }

        // Truncate very long outputs
        if (output.length > 30_000) {
          output = output.slice(0, 30_000) + '\n... (truncated)'
        }

        results.push({ tool: step.tool, success: true, output })
        successCount++
      } catch (err) {
        results.push({
          tool: step.tool,
          success: false,
          output: `<tool_use_error>Execution error: ${(err as Error).message}</tool_use_error>`,
        })
        failCount++

        // Abort remaining steps if the context was aborted
        if (context.abortController.signal.aborted) break
      }
    }

    return {
      data: {
        description: input.description,
        steps: results,
        totalSteps: input.steps.length,
        successCount,
        failCount,
      } as REPLOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: REPLOutput, toolUseID: string) {
    const lines: string[] = []

    if (data.description) {
      lines.push(`## ${data.description}`)
      lines.push('')
    }

    lines.push(`Executed ${data.totalSteps} steps: ${data.successCount} succeeded, ${data.failCount} failed.`)
    lines.push('')

    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i]!
      const icon = step.success ? '✓' : '✗'
      lines.push(`### Step ${i + 1}: ${icon} ${step.tool}`)
      lines.push(step.output)
      lines.push('')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n').trim(),
      is_error: data.failCount > 0 && data.successCount === 0,
    }
  },
})
