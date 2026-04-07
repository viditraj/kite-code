/**
 * PipelineTool — Agent-facing tools for managing and running pipelines.
 *
 * Provides 5 tools:
 * - PipelineRun: Execute a pipeline by name
 * - PipelineList: List all discovered pipelines
 * - PipelineStatus: Show run history and stage results
 * - PipelineValidate: Validate a pipeline YAML definition
 * - PipelineDelete: Remove a pipeline file
 *
 * These tools allow the LLM agent to interact with the pipeline system
 * from within a conversation — creating, running, and monitoring pipelines.
 */

import { z } from 'zod'
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import { discoverPipelines, findPipeline, loadPipelineFromString, loadPipelineFromFile } from '../../services/pipeline/loader.js'
import { executePipeline } from '../../services/pipeline/executor.js'
import type { ExecutorOptions, PipelineProgressEvent } from '../../services/pipeline/executor.js'
import { getRunHistory, getRunById } from '../../services/pipeline/logger.js'
import type { PipelineRun, PipelineDefinition } from '../../services/pipeline/types.js'

// ============================================================================
// PipelineRun tool
// ============================================================================

const PIPELINE_RUN_NAME = 'PipelineRun'

const pipelineRunInputSchema = z.strictObject({
  name: z.string().describe('Name of the pipeline to run (as defined in the pipeline YAML)'),
  variables: z.record(z.string()).optional().describe('Runtime variable overrides (key-value pairs)'),
  dryRun: z.boolean().optional().describe('If true, run in plan-only mode (no write operations)'),
})

type PipelineRunInput = z.infer<typeof pipelineRunInputSchema>

interface PipelineRunOutput {
  run: PipelineRun | null
  message: string
  success: boolean
}

export const PipelineRunTool = buildTool({
  name: PIPELINE_RUN_NAME,
  searchHint: 'run execute pipeline automation workflow',
  maxResultSizeChars: 100_000,
  shouldDefer: true,

  inputSchema: pipelineRunInputSchema,

  isReadOnly() { return false },
  isConcurrencySafe() { return false },

  async description(input: PipelineRunInput) {
    return `Run pipeline "${input.name}"${input.dryRun ? ' (dry run)' : ''}`
  },

  async prompt() {
    return `Run a previously defined pipeline by name. Pipelines are YAML files in .kite/pipelines/ or ~/.kite/pipelines/.

Input:
- name: The pipeline name (matches the 'name' field in the YAML)
- variables: (optional) Runtime variable overrides
- dryRun: (optional) If true, skips write operations

The pipeline executes all stages sequentially, passing data between stages via {{ }} interpolation.
Returns the full run result including per-stage output, cost, and status.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'PipelineRun' },

  getToolUseSummary(input?: Partial<PipelineRunInput>) {
    if (!input?.name) return null
    return `Running pipeline "${input.name}"${input.dryRun ? ' (dry run)' : ''}`
  },

  getActivityDescription(input?: Partial<PipelineRunInput>) {
    if (!input?.name) return 'Running pipeline'
    return `Running pipeline "${input.name}"`
  },

  async validateInput(input: PipelineRunInput) {
    if (!input.name || !input.name.trim()) {
      return { result: false, message: 'Pipeline name cannot be empty', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: PipelineRunInput, context: ToolUseContext) {
    const cwd = context.getCwd()
    const found = findPipeline(input.name.trim(), cwd)

    if (!found) {
      const available = discoverPipelines(cwd).map(p => p.pipeline.name)
      return {
        data: {
          run: null,
          message: `Pipeline "${input.name}" not found. Available pipelines: ${available.length > 0 ? available.join(', ') : 'none'}`,
          success: false,
        } as PipelineRunOutput,
      }
    }

    // Get provider from appState
    const appState = context.getAppState()
    const provider = appState._provider as import('../../providers/types.js').LLMProvider | undefined
    if (!provider) {
      return {
        data: {
          run: null,
          message: 'No LLM provider available. Cannot execute pipeline.',
          success: false,
        } as PipelineRunOutput,
      }
    }

    // Get tools
    const tools = context.options.tools

    // Get system prompt builder
    let getSystemPrompt: (model: string, toolNames: string[]) => string
    try {
      const prompts = await import('../../constants/prompts.js')
      getSystemPrompt = prompts.getSystemPrompt
    } catch {
      getSystemPrompt = () => 'You are Kite, an AI coding assistant. Complete the task described below.'
    }

    const config = appState._config as Record<string, unknown> | undefined
    const defaultModel = (config as any)?.provider?.model ?? context.options.mainLoopModel ?? 'claude-sonnet-4-20250514'

    const executorOptions: ExecutorOptions = {
      provider,
      tools,
      defaultModel,
      getSystemPrompt,
      abortSignal: context.abortController.signal,
      variables: input.variables,
      dryRun: input.dryRun,
    }

    try {
      const run = await executePipeline(found.pipeline, executorOptions)
      return {
        data: {
          run,
          message: `Pipeline "${input.name}" ${run.status}: ${run.error ?? 'all stages completed'}`,
          success: run.status === 'completed',
        } as PipelineRunOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          run: null,
          message: `Pipeline execution failed: ${message}`,
          success: false,
        } as PipelineRunOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: PipelineRunOutput, toolUseID: string) {
    const lines: string[] = [data.message]

    if (data.run) {
      lines.push('')
      lines.push(`Run ID: ${data.run.id}`)
      lines.push(`Status: ${data.run.status}`)
      lines.push(`Duration: ${data.run.completedAt ? ((data.run.completedAt - data.run.startedAt) / 1000).toFixed(1) + 's' : 'in progress'}`)
      lines.push(`Cost: $${data.run.totalCostUsd.toFixed(4)}`)
      lines.push('')
      lines.push('Stages:')

      for (const [name, result] of Object.entries(data.run.stages)) {
        const duration = result.completedAt && result.startedAt
          ? ((result.completedAt - result.startedAt) / 1000).toFixed(1) + 's'
          : '-'
        const statusIcon = result.status === 'completed' ? '[OK]'
          : result.status === 'failed' ? '[FAIL]'
          : result.status === 'skipped' ? '[SKIP]'
          : `[${result.status.toUpperCase()}]`

        lines.push(`  ${statusIcon} ${name} (${duration})`)
        if (result.error) {
          lines.push(`    Error: ${result.error}`)
        }
        if (result.output && result.output.length > 0) {
          const preview = result.output.length > 500 ? result.output.slice(0, 500) + '...' : result.output
          lines.push(`    Output: ${preview}`)
        }
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
      is_error: !data.success,
    }
  },
})

// ============================================================================
// PipelineList tool
// ============================================================================

const PIPELINE_LIST_NAME = 'PipelineList'

const pipelineListInputSchema = z.strictObject({})

interface PipelineListOutput {
  pipelines: Array<{
    name: string
    description: string | undefined
    trigger: string
    stageCount: number
    filePath: string
  }>
  message: string
}

export const PipelineListTool = buildTool({
  name: PIPELINE_LIST_NAME,
  searchHint: 'list pipelines automation workflows',
  maxResultSizeChars: 30_000,
  shouldDefer: true,

  inputSchema: pipelineListInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description() { return 'List all available pipelines' },

  async prompt() {
    return `List all discovered pipelines from .kite/pipelines/ and ~/.kite/pipelines/ directories.
Shows pipeline name, description, trigger type, and stage count.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'PipelineList' },
  getToolUseSummary() { return 'Listing pipelines' },
  getActivityDescription() { return 'Listing available pipelines' },

  async call(_input: z.infer<typeof pipelineListInputSchema>, context: ToolUseContext) {
    const cwd = context.getCwd()
    const discovered = discoverPipelines(cwd)

    const pipelines = discovered.map(({ pipeline, filePath }) => ({
      name: pipeline.name,
      description: pipeline.description,
      trigger: formatTrigger(pipeline),
      stageCount: pipeline.stages.length,
      filePath,
    }))

    return {
      data: {
        pipelines,
        message: pipelines.length === 0
          ? 'No pipelines found. Create a YAML file in .kite/pipelines/ to define a pipeline.'
          : `Found ${pipelines.length} pipeline(s).`,
      } as PipelineListOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: PipelineListOutput, toolUseID: string) {
    if (data.pipelines.length === 0) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: data.message,
      }
    }

    const lines = [data.message, '']
    for (const p of data.pipelines) {
      lines.push(`  ${p.name}`)
      if (p.description) lines.push(`    Description: ${p.description}`)
      lines.push(`    Trigger: ${p.trigger}`)
      lines.push(`    Stages: ${p.stageCount}`)
      lines.push(`    File: ${p.filePath}`)
      lines.push('')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n').trim(),
    }
  },
})

// ============================================================================
// PipelineStatus tool
// ============================================================================

const PIPELINE_STATUS_NAME = 'PipelineStatus'

const pipelineStatusInputSchema = z.strictObject({
  name: z.string().describe('Pipeline name to get status for'),
  runId: z.string().optional().describe('Specific run ID to get details for (omit for recent history)'),
  limit: z.number().optional().describe('Number of recent runs to show (default: 10)'),
})

type PipelineStatusInput = z.infer<typeof pipelineStatusInputSchema>

interface PipelineStatusOutput {
  runs: PipelineRun[]
  message: string
}

export const PipelineStatusTool = buildTool({
  name: PIPELINE_STATUS_NAME,
  searchHint: 'pipeline status history runs results',
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  inputSchema: pipelineStatusInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description(input: PipelineStatusInput) {
    return `Get status for pipeline "${input.name}"`
  },

  async prompt() {
    return `Get the run history and status for a pipeline.

Input:
- name: Pipeline name
- runId: (optional) Get details for a specific run
- limit: (optional) Number of recent runs to show (default: 10)

Returns run history with per-stage results, costs, and timings.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'PipelineStatus' },

  getToolUseSummary(input?: Partial<PipelineStatusInput>) {
    if (!input?.name) return null
    return `Status for "${input.name}"`
  },

  getActivityDescription(input?: Partial<PipelineStatusInput>) {
    if (!input?.name) return 'Checking pipeline status'
    return `Checking status of "${input.name}"`
  },

  async call(input: PipelineStatusInput, _context: ToolUseContext) {
    if (input.runId) {
      const run = getRunById(input.name, input.runId)
      if (!run) {
        return {
          data: {
            runs: [],
            message: `Run "${input.runId}" not found for pipeline "${input.name}"`,
          } as PipelineStatusOutput,
        }
      }
      return {
        data: {
          runs: [run],
          message: `Run ${input.runId} for "${input.name}": ${run.status}`,
        } as PipelineStatusOutput,
      }
    }

    const runs = getRunHistory(input.name, input.limit ?? 10)
    return {
      data: {
        runs,
        message: runs.length === 0
          ? `No run history for pipeline "${input.name}"`
          : `${runs.length} recent run(s) for "${input.name}"`,
      } as PipelineStatusOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: PipelineStatusOutput, toolUseID: string) {
    if (data.runs.length === 0) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: data.message,
      }
    }

    const lines = [data.message, '']
    for (const run of data.runs) {
      const duration = run.completedAt
        ? ((run.completedAt - run.startedAt) / 1000).toFixed(1) + 's'
        : 'in progress'
      const date = new Date(run.startedAt).toISOString()

      lines.push(`Run ${run.id.slice(0, 8)} | ${run.status} | ${date} | ${duration} | $${run.totalCostUsd.toFixed(4)}`)

      for (const [name, result] of Object.entries(run.stages)) {
        const icon = result.status === 'completed' ? '[OK]'
          : result.status === 'failed' ? '[FAIL]'
          : result.status === 'skipped' ? '[SKIP]'
          : `[${result.status.toUpperCase()}]`
        lines.push(`  ${icon} ${name}${result.error ? ': ' + result.error : ''}`)
      }
      lines.push('')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n').trim(),
    }
  },
})

// ============================================================================
// PipelineValidate tool
// ============================================================================

const PIPELINE_VALIDATE_NAME = 'PipelineValidate'

const pipelineValidateInputSchema = z.strictObject({
  yaml: z.string().optional().describe('YAML content to validate (provide either yaml or filePath)'),
  filePath: z.string().optional().describe('Path to a YAML file to validate'),
})

type PipelineValidateInput = z.infer<typeof pipelineValidateInputSchema>

interface PipelineValidateOutput {
  valid: boolean
  errors: Array<{ path: string; message: string }>
  pipelineName: string | null
  message: string
}

export const PipelineValidateTool = buildTool({
  name: PIPELINE_VALIDATE_NAME,
  searchHint: 'validate check pipeline yaml definition',
  maxResultSizeChars: 20_000,
  shouldDefer: true,

  inputSchema: pipelineValidateInputSchema,

  isReadOnly() { return true },
  isConcurrencySafe() { return true },

  async description() { return 'Validate a pipeline YAML definition' },

  async prompt() {
    return `Validate a pipeline YAML definition for correctness.

Input (provide one):
- yaml: The YAML content as a string
- filePath: Path to a YAML file

Checks:
- Required fields (name, trigger, stages)
- Valid trigger types and cron expressions
- Stage names are unique
- Tools and settings are valid
- No circular references`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() { return 'PipelineValidate' },
  getToolUseSummary() { return 'Validating pipeline' },
  getActivityDescription() { return 'Validating pipeline definition' },

  async validateInput(input: PipelineValidateInput) {
    if (!input.yaml && !input.filePath) {
      return { result: false, message: 'Provide either yaml content or filePath', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: PipelineValidateInput, _context: ToolUseContext) {
    if (input.filePath) {
      const result = loadPipelineFromFile(input.filePath)
      return {
        data: {
          valid: result.validation.valid,
          errors: result.validation.errors,
          pipelineName: result.pipeline?.name ?? null,
          message: result.validation.valid
            ? `Pipeline "${result.pipeline!.name}" is valid`
            : `Validation failed with ${result.validation.errors.length} error(s)`,
        } as PipelineValidateOutput,
      }
    }

    const result = loadPipelineFromString(input.yaml!)
    return {
      data: {
        valid: result.validation.valid,
        errors: result.validation.errors,
        pipelineName: result.pipeline?.name ?? null,
        message: result.validation.valid
          ? `Pipeline "${result.pipeline!.name}" is valid`
          : `Validation failed with ${result.validation.errors.length} error(s)`,
      } as PipelineValidateOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: PipelineValidateOutput, toolUseID: string) {
    const lines = [data.message]

    if (data.errors.length > 0) {
      lines.push('')
      for (const err of data.errors) {
        lines.push(`  [${err.path}] ${err.message}`)
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n'),
      is_error: !data.valid,
    }
  },
})

// ============================================================================
// PipelineDelete tool
// ============================================================================

const PIPELINE_DELETE_NAME = 'PipelineDelete'

const pipelineDeleteInputSchema = z.strictObject({
  name: z.string().describe('Name of the pipeline to delete'),
})

type PipelineDeleteInput = z.infer<typeof pipelineDeleteInputSchema>

interface PipelineDeleteOutput {
  deleted: boolean
  message: string
}

export const PipelineDeleteTool = buildTool({
  name: PIPELINE_DELETE_NAME,
  searchHint: 'delete remove pipeline',
  maxResultSizeChars: 5_000,
  shouldDefer: true,

  inputSchema: pipelineDeleteInputSchema,

  isReadOnly() { return false },
  isConcurrencySafe() { return false },

  async description(input: PipelineDeleteInput) {
    return `Delete pipeline "${input.name}"`
  },

  async prompt() {
    return `Delete a pipeline YAML file by name.
Removes the pipeline definition from .kite/pipelines/ or ~/.kite/pipelines/.
Does NOT delete run history logs.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'passthrough' as const, message: `Delete pipeline "${input.name}"` }
  },

  userFacingName() { return 'PipelineDelete' },

  getToolUseSummary(input?: Partial<PipelineDeleteInput>) {
    if (!input?.name) return null
    return `Deleting pipeline "${input.name}"`
  },

  getActivityDescription(input?: Partial<PipelineDeleteInput>) {
    if (!input?.name) return 'Deleting pipeline'
    return `Deleting pipeline "${input.name}"`
  },

  async validateInput(input: PipelineDeleteInput) {
    if (!input.name || !input.name.trim()) {
      return { result: false, message: 'Pipeline name cannot be empty', errorCode: 1 }
    }
    return { result: true }
  },

  async call(input: PipelineDeleteInput, context: ToolUseContext) {
    const cwd = context.getCwd()
    const found = findPipeline(input.name.trim(), cwd)

    if (!found) {
      return {
        data: {
          deleted: false,
          message: `Pipeline "${input.name}" not found`,
        } as PipelineDeleteOutput,
      }
    }

    try {
      unlinkSync(found.filePath)
      return {
        data: {
          deleted: true,
          message: `Deleted pipeline "${input.name}" (${found.filePath})`,
        } as PipelineDeleteOutput,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        data: {
          deleted: false,
          message: `Failed to delete: ${message}`,
        } as PipelineDeleteOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: PipelineDeleteOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: data.message,
      is_error: !data.deleted,
    }
  },
})

// ============================================================================
// Helpers
// ============================================================================

function formatTrigger(pipeline: PipelineDefinition): string {
  const t = pipeline.trigger
  switch (t.type) {
    case 'cron': return `cron: ${t.schedule}`
    case 'webhook': return `webhook${t.path ? ` (${t.path})` : ''}`
    case 'file-watch': return `file-watch: ${t.paths.join(', ')}`
    case 'manual': return 'manual'
    default: return 'unknown'
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  PIPELINE_RUN_NAME,
  PIPELINE_LIST_NAME,
  PIPELINE_STATUS_NAME,
  PIPELINE_VALIDATE_NAME,
  PIPELINE_DELETE_NAME,
}
