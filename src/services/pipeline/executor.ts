/**
 * Pipeline executor — runs pipeline stages sequentially via QueryEngine.
 *
 * This is the core orchestration engine. For each stage:
 * 1. Evaluate condition (skip if false)
 * 2. Interpolate {{ }} variables in the prompt
 * 3. Filter tools based on stage.tools whitelist
 * 4. Create a fresh QueryEngine with stage-specific settings
 * 5. Run the stage via runToCompletion()
 * 6. Check stopIf, handle retries, update run state
 * 7. Log results
 *
 * Each stage gets its own QueryEngine with a fresh conversation.
 * Data flows between stages via {{ stages.<name>.output }} interpolation.
 */

import { randomUUID } from 'crypto'
import type { LLMProvider, TokenUsage } from '../../providers/types.js'
import type { Tools, Tool } from '../../Tool.js'
import type { ToolPermissionContext } from '../../types/permissions.js'
import { createEmptyToolPermissionContext } from '../../types/permissions.js'
import { QueryEngine } from '../../QueryEngine.js'
import type {
  PipelineDefinition,
  PipelineStage,
  PipelineRun,
  PipelineRunStatus,
  StageResult,
  StageStatus,
  PipelineSettings,
  NotifyConfig,
} from './types.js'
import { createPipelineRun, createEmptyStageResult } from './types.js'
import { buildInterpolationContext, interpolate, evaluateCondition } from './context.js'
import type { InterpolationContext } from './context.js'
import { logRunStart, logStageStart, logStageComplete, logRunComplete } from './logger.js'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STAGE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_MAX_TURNS = 50
const DEFAULT_MAX_TOKENS = 8192

// ============================================================================
// Executor options
// ============================================================================

export interface ExecutorOptions {
  /** LLM provider instance */
  provider: LLMProvider
  /** All available tools (built-in + MCP) */
  tools: Tools
  /** Kite config model name (fallback if pipeline doesn't specify) */
  defaultModel: string
  /** Kite config max tokens (fallback) */
  defaultMaxTokens?: number
  /** System prompt builder */
  getSystemPrompt: (model: string, toolNames: string[]) => string
  /** Callback for progress reporting */
  onProgress?: (event: PipelineProgressEvent) => void
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal
  /** Runtime variable overrides */
  variables?: Record<string, string>
  /** Whether to write logs (default: true) */
  enableLogging?: boolean
  /** Whether this is a dry run (plan only, no writes) */
  dryRun?: boolean
}

export type PipelineProgressEvent =
  | { type: 'run_start'; run: PipelineRun }
  | { type: 'stage_start'; stageName: string; stageIndex: number; totalStages: number }
  | { type: 'stage_skip'; stageName: string; reason: string }
  | { type: 'stage_complete'; stageName: string; result: StageResult }
  | { type: 'stage_retry'; stageName: string; attempt: number; maxRetries: number; error: string }
  | { type: 'stage_stop'; stageName: string; reason: string }
  | { type: 'run_complete'; run: PipelineRun }
  | { type: 'cost_warning'; currentCost: number; maxCost: number }

// ============================================================================
// Pipeline executor
// ============================================================================

/**
 * Execute a pipeline definition end-to-end.
 *
 * Returns the completed PipelineRun with all stage results.
 * Handles retries, conditions, stopIf, cost tracking, timeouts,
 * and cancellation.
 */
export async function executePipeline(
  pipeline: PipelineDefinition,
  options: ExecutorOptions,
): Promise<PipelineRun> {
  const runId = randomUUID()
  const trigger = determineTrigger(pipeline)
  const run = createPipelineRun(pipeline.name, trigger, runId, options.variables)
  const shouldLog = options.enableLogging !== false

  // Initialize all stages as pending
  for (const stage of pipeline.stages) {
    run.stages[stage.name] = createEmptyStageResult()
  }

  if (shouldLog) logRunStart(run)
  options.onProgress?.({ type: 'run_start', run })

  const settings = pipeline.settings ?? {}
  const maxCostUsd = settings.maxCostUsd ?? 0

  try {
    for (let i = 0; i < pipeline.stages.length; i++) {
      // Check cancellation
      if (options.abortSignal?.aborted) {
        run.status = 'cancelled'
        run.error = 'Pipeline cancelled by user'
        break
      }

      const stage = pipeline.stages[i]!
      const ctx = buildInterpolationContext(run, settings, settings.env)

      // Check cost budget
      if (maxCostUsd > 0 && run.totalCostUsd >= maxCostUsd) {
        run.status = 'stopped'
        run.error = `Cost budget exceeded: $${run.totalCostUsd.toFixed(4)} >= $${maxCostUsd.toFixed(2)}`
        options.onProgress?.({ type: 'cost_warning', currentCost: run.totalCostUsd, maxCost: maxCostUsd })
        break
      }

      // Evaluate condition
      if (stage.condition) {
        const conditionResult = evaluateCondition(stage.condition, ctx)
        if (!conditionResult) {
          run.stages[stage.name] = {
            ...createEmptyStageResult(),
            status: 'skipped',
            output: `Condition not met: ${stage.condition}`,
          }
          options.onProgress?.({ type: 'stage_skip', stageName: stage.name, reason: `Condition false: ${stage.condition}` })
          continue
        }
      }

      // Execute stage (with retries)
      const maxRetries = stage.retries ?? pipeline.retries ?? 0
      let lastError: string | undefined
      let stageResult: StageResult | null = null

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        if (options.abortSignal?.aborted) break

        options.onProgress?.({ type: 'stage_start', stageName: stage.name, stageIndex: i, totalStages: pipeline.stages.length })
        if (shouldLog) logStageStart(run, stage.name)

        try {
          stageResult = await executeStage(stage, pipeline, options, ctx, attempt)

          // Update run
          run.stages[stage.name] = stageResult
          run.totalCostUsd += stageResult.costUsd

          if (shouldLog) logStageComplete(run, stage.name, stageResult)
          options.onProgress?.({ type: 'stage_complete', stageName: stage.name, result: stageResult })

          if (stageResult.status === 'completed') {
            break // Success — no retry needed
          }

          // Stage failed
          lastError = stageResult.error ?? 'Unknown stage failure'

          if (attempt <= maxRetries) {
            options.onProgress?.({
              type: 'stage_retry',
              stageName: stage.name,
              attempt,
              maxRetries,
              error: lastError,
            })
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err)
          stageResult = {
            ...createEmptyStageResult(),
            status: 'failed',
            error: lastError,
            attempt,
            startedAt: Date.now(),
            completedAt: Date.now(),
          }
          run.stages[stage.name] = stageResult

          if (shouldLog) logStageComplete(run, stage.name, stageResult)

          if (attempt <= maxRetries) {
            options.onProgress?.({
              type: 'stage_retry',
              stageName: stage.name,
              attempt,
              maxRetries,
              error: lastError,
            })
          }
        }
      }

      // After all attempts, check if stage succeeded
      const finalResult = run.stages[stage.name]!
      if (finalResult.status === 'failed' && !stage.optional) {
        const failureAction = pipeline.onFailure ?? 'stop'
        if (failureAction === 'stop') {
          run.status = 'failed'
          run.error = `Stage "${stage.name}" failed: ${finalResult.error ?? lastError ?? 'unknown'}`
          break
        }
        // 'continue' — keep going to next stage
      }

      // Check stopIf
      if (stage.stopIf && finalResult.output.includes(stage.stopIf)) {
        run.status = 'stopped'
        run.error = `Pipeline stopped: stage "${stage.name}" output matched stopIf pattern "${stage.stopIf}"`
        options.onProgress?.({ type: 'stage_stop', stageName: stage.name, reason: `Output matched stopIf: "${stage.stopIf}"` })
        break
      }
    }

    // Finalize run
    if (run.status === 'running') {
      // All stages completed without early termination
      const hasFailures = Object.values(run.stages).some(s => s.status === 'failed')
      run.status = hasFailures ? 'failed' : 'completed'
    }
  } catch (err: unknown) {
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : String(err)
  }

  run.completedAt = Date.now()
  if (shouldLog) logRunComplete(run)
  options.onProgress?.({ type: 'run_complete', run })

  // Send failure notification if configured
  if (run.status === 'failed' && pipeline.notifyOnFailure) {
    await sendNotification(pipeline.notifyOnFailure, run).catch(() => {
      // Notification failure is non-fatal
    })
  }

  return run
}

// ============================================================================
// Stage execution
// ============================================================================

async function executeStage(
  stage: PipelineStage,
  pipeline: PipelineDefinition,
  options: ExecutorOptions,
  ctx: InterpolationContext,
  attempt: number,
): Promise<StageResult> {
  const startedAt = Date.now()
  const settings = pipeline.settings ?? {}

  // Interpolate the prompt
  const prompt = interpolate(stage.prompt, ctx)

  // Determine model
  const model = stage.model ?? settings.model ?? options.defaultModel

  // Filter tools
  const stageTools = filterToolsForStage(options.tools, stage, options.dryRun ?? false)

  // Build system prompt
  const toolNames = stageTools.map(t => t.name)
  let systemPrompt = options.getSystemPrompt(model, toolNames)

  // Append stage-specific system prompt
  if (stage.systemPrompt) {
    systemPrompt += '\n\n' + interpolate(stage.systemPrompt, ctx)
  }

  // Add pipeline context to system prompt
  systemPrompt += buildPipelineSystemPromptSuffix(pipeline, stage, attempt)

  // Determine max turns and tokens
  const maxTurns = stage.maxTurns ?? settings.maxTurns ?? DEFAULT_MAX_TURNS
  const maxTokens = settings.maxTokens ?? options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS

  // Build permission context for headless execution
  const permissionMode = settings.permissionMode ?? 'bypassPermissions'
  const permissionContext: ToolPermissionContext = {
    ...createEmptyToolPermissionContext(),
    mode: permissionMode as ToolPermissionContext['mode'],
  }

  // Create a fresh QueryEngine for this stage
  const engine = new QueryEngine({
    provider: options.provider,
    tools: stageTools,
    model,
    maxTokens,
    maxTurns,
    systemPrompt,
    cwd: settings.cwd ?? process.cwd(),
    isNonInteractiveSession: true,
    permissionContext,
  })

  // Execute with timeout
  const timeoutMs = stage.timeout ?? DEFAULT_STAGE_TIMEOUT_MS

  const { assistantText, terminal } = await runWithTimeout(
    () => engine.runToCompletion(prompt),
    timeoutMs,
    options.abortSignal,
  )

  const completedAt = Date.now()

  // Estimate cost from token usage
  const usage = engine.getUsage()
  const costUsd = estimateStageCost(usage, model)

  // Determine stage status
  let status: StageStatus = 'completed'
  let error: string | undefined

  if (terminal.reason === 'completed') {
    status = 'completed'
  } else if (terminal.reason === 'max_turns') {
    status = 'completed' // Got output but hit turn limit
    error = `Hit max turns limit (${maxTurns})`
  } else if (terminal.reason === 'model_error') {
    status = 'failed'
    error = 'error' in terminal ? (terminal as { error: Error }).error.message : 'Model error'
  } else if (terminal.reason === 'aborted_streaming' || terminal.reason === 'aborted_tools') {
    status = 'failed'
    error = 'Stage was aborted'
  } else {
    status = 'failed'
    error = `Unexpected terminal reason: ${terminal.reason}`
  }

  return {
    status,
    output: assistantText,
    error,
    startedAt,
    completedAt,
    costUsd,
    turnCount: terminal.reason === 'max_turns' && 'turnCount' in terminal ? (terminal as { turnCount: number }).turnCount : 0,
    attempt,
  }
}

// ============================================================================
// Tool filtering
// ============================================================================

/**
 * Filter the tool pool based on stage configuration.
 *
 * Supports:
 * - Exact tool names: ["Read", "Grep", "Bash"]
 * - MCP wildcard: ["mcp__playwright__*"] matches all tools from that server
 * - No tools specified: all tools available
 * - Dry run: removes write tools (FileWrite, FileEdit, Bash) but keeps read tools
 */
function filterToolsForStage(allTools: Tools, stage: PipelineStage, dryRun: boolean): Tools {
  let filtered: Tools = allTools

  if (stage.tools && stage.tools.length > 0) {
    const toolFilters = stage.tools
    filtered = allTools.filter(tool => {
      for (const filter of toolFilters) {
        // Wildcard match for MCP tools: "mcp__server__*"
        if (filter.endsWith('*')) {
          const prefix = filter.slice(0, -1)
          if (tool.name.startsWith(prefix)) return true
        }
        // Exact match
        if (tool.name === filter) return true
        // Case-insensitive match
        if (tool.name.toLowerCase() === filter.toLowerCase()) return true
      }
      return false
    })
  }

  // Dry run: remove write/destructive tools
  if (dryRun) {
    const WRITE_TOOLS = new Set(['FileWrite', 'FileEdit', 'Bash', 'PowerShell', 'NotebookEdit'])
    filtered = filtered.filter(t => !WRITE_TOOLS.has(t.name))
  }

  return filtered
}

// ============================================================================
// Timeout wrapper
// ============================================================================

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error(`Stage timed out after ${timeoutMs / 1000}s`))
      }
    }, timeoutMs)

    // Also check abort signal
    const onAbort = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error('Stage cancelled'))
      }
    }
    abortSignal?.addEventListener('abort', onAbort)

    fn().then(
      (result) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          abortSignal?.removeEventListener('abort', onAbort)
          resolve(result)
        }
      },
      (error) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          abortSignal?.removeEventListener('abort', onAbort)
          reject(error)
        }
      },
    )
  })
}

// ============================================================================
// Cost estimation
// ============================================================================

/** Rough cost estimation based on model name patterns */
function estimateStageCost(usage: TokenUsage, model: string): number {
  // Cost per million tokens (input, output)
  const costs: Record<string, [number, number]> = {
    'claude-sonnet-4': [3.0, 15.0],
    'claude-opus-4': [15.0, 75.0],
    'claude-haiku-3': [0.8, 4.0],
    'gpt-4o': [2.5, 10.0],
    'gpt-4o-mini': [0.15, 0.6],
    'o1': [15.0, 60.0],
    'o3': [10.0, 40.0],
    'deepseek': [0.14, 0.28],
    'gemini': [0.1, 0.4],
    'mistral': [2.0, 6.0],
  }

  let inputCostPerM = 3.0
  let outputCostPerM = 15.0

  for (const [pattern, [inp, out]] of Object.entries(costs)) {
    if (model.includes(pattern)) {
      inputCostPerM = inp
      outputCostPerM = out
      break
    }
  }

  const inputCost = (usage.inputTokens / 1_000_000) * inputCostPerM
  const outputCost = (usage.outputTokens / 1_000_000) * outputCostPerM
  return inputCost + outputCost
}

// ============================================================================
// Pipeline system prompt suffix
// ============================================================================

function buildPipelineSystemPromptSuffix(
  pipeline: PipelineDefinition,
  stage: PipelineStage,
  attempt: number,
): string {
  const lines = [
    '',
    '## Pipeline Context',
    `You are executing stage "${stage.name}" of pipeline "${pipeline.name}".`,
    'This is a headless automated pipeline. Do NOT ask the user for input.',
    'Complete the task described in the prompt autonomously.',
    'Be thorough and precise. Output structured data when possible.',
  ]

  if (attempt > 1) {
    lines.push(`This is retry attempt ${attempt}. The previous attempt failed. Try a different approach.`)
  }

  if (stage.stopIf) {
    lines.push(`IMPORTANT: If the condition for stopping is met, include the exact text "${stage.stopIf}" in your response.`)
  }

  return lines.join('\n')
}

// ============================================================================
// Trigger detection
// ============================================================================

function determineTrigger(pipeline: PipelineDefinition): PipelineRun['trigger'] {
  return pipeline.trigger.type === 'cron' ? 'cron'
    : pipeline.trigger.type === 'webhook' ? 'webhook'
    : pipeline.trigger.type === 'file-watch' ? 'file-watch'
    : 'manual'
}

// ============================================================================
// Notification
// ============================================================================

async function sendNotification(config: NotifyConfig, run: PipelineRun): Promise<void> {
  if (config.type === 'webhook' && config.url) {
    const body = JSON.stringify({
      pipeline: run.pipelineName,
      runId: run.id,
      status: run.status,
      error: run.error,
      duration: run.completedAt ? run.completedAt - run.startedAt : 0,
      totalCost: run.totalCostUsd,
      stages: Object.fromEntries(
        Object.entries(run.stages).map(([name, result]) => [
          name,
          { status: result.status, error: result.error },
        ]),
      ),
    })

    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body,
    })
  }

  if (config.type === 'command' && config.command) {
    const { execSync } = await import('child_process')
    const env = {
      ...process.env,
      PIPELINE_NAME: run.pipelineName,
      PIPELINE_RUN_ID: run.id,
      PIPELINE_STATUS: run.status,
      PIPELINE_ERROR: run.error ?? '',
    }
    execSync(config.command, { env, timeout: 30_000, stdio: 'ignore' })
  }
}
