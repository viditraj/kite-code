/**
 * Pipeline scheduler — real cron executor using node-cron.
 *
 * Manages scheduled pipeline executions:
 * - Starts/stops cron jobs based on pipeline trigger definitions
 * - Tracks active schedules and their next run times
 * - Ensures only one instance of a pipeline runs at a time
 * - Graceful shutdown with cleanup
 * - Health checking and status reporting
 */

import cron from 'node-cron'
import type { LLMProvider } from '../../providers/types.js'
import type { Tools } from '../../Tool.js'
import type { PipelineDefinition, PipelineRun } from './types.js'
import { discoverPipelines } from './loader.js'
import { executePipeline } from './executor.js'
import type { ExecutorOptions, PipelineProgressEvent } from './executor.js'
import { rotateLogs } from './logger.js'

// ============================================================================
// Types
// ============================================================================

export interface SchedulerOptions {
  /** LLM provider */
  provider: LLMProvider
  /** Available tools */
  tools: Tools
  /** Default model */
  defaultModel: string
  /** Default max tokens */
  defaultMaxTokens?: number
  /** System prompt builder */
  getSystemPrompt: (model: string, toolNames: string[]) => string
  /** Working directory for pipeline discovery */
  cwd?: string
  /** Progress callback */
  onProgress?: (pipelineName: string, event: PipelineProgressEvent) => void
  /** Called when a pipeline run completes */
  onRunComplete?: (pipelineName: string, run: PipelineRun) => void
  /** Called on errors */
  onError?: (pipelineName: string, error: Error) => void
}

interface ScheduledJob {
  pipeline: PipelineDefinition
  filePath: string
  task: ReturnType<typeof cron.schedule>
  isRunning: boolean
  lastRun: PipelineRun | null
  nextRun: Date | null
}

// ============================================================================
// PipelineScheduler class
// ============================================================================

export class PipelineScheduler {
  private options: SchedulerOptions
  private jobs: Map<string, ScheduledJob> = new Map()
  private abortController: AbortController = new AbortController()
  private running = false
  private logRotationTask: ReturnType<typeof cron.schedule> | null = null

  constructor(options: SchedulerOptions) {
    this.options = options
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start the scheduler: discover pipelines, schedule cron-triggered ones.
   */
  start(): void {
    if (this.running) return
    this.running = true

    // Discover and schedule pipelines
    this.refresh()

    // Schedule daily log rotation at 3am
    this.logRotationTask = cron.schedule('0 3 * * *', () => {
      try {
        rotateLogs()
      } catch {
        // Non-fatal
      }
    })
  }

  /**
   * Stop all scheduled jobs and clean up.
   */
  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    // Signal all running pipelines to abort
    this.abortController.abort('scheduler_stop')

    // Stop all cron tasks
    for (const [, job] of this.jobs) {
      job.task.stop()
    }
    this.jobs.clear()

    // Stop log rotation
    this.logRotationTask?.stop()
    this.logRotationTask = null

    // Create fresh abort controller for next start
    this.abortController = new AbortController()
  }

  /**
   * Re-discover pipelines and update schedules.
   * Adds new pipelines, removes deleted ones, updates changed ones.
   */
  refresh(): void {
    const discovered = discoverPipelines(this.options.cwd)
    const newNames = new Set<string>()

    for (const { pipeline, filePath } of discovered) {
      // Only schedule cron-triggered pipelines
      if (pipeline.trigger.type !== 'cron') continue

      newNames.add(pipeline.name)
      const existing = this.jobs.get(pipeline.name)

      if (existing) {
        // Check if schedule changed
        const existingSchedule = existing.pipeline.trigger.type === 'cron'
          ? existing.pipeline.trigger.schedule : ''
        if (existingSchedule === pipeline.trigger.schedule && existing.filePath === filePath) {
          continue // No change
        }
        // Schedule changed — stop old, create new
        existing.task.stop()
      }

      // Create new scheduled job
      this.scheduleJob(pipeline, filePath)
    }

    // Remove jobs for pipelines that no longer exist
    for (const [name, job] of this.jobs) {
      if (!newNames.has(name)) {
        job.task.stop()
        this.jobs.delete(name)
      }
    }
  }

  // ========================================================================
  // Status
  // ========================================================================

  /**
   * Get status of all scheduled jobs.
   */
  getStatus(): Array<{
    pipelineName: string
    schedule: string
    isRunning: boolean
    lastRunStatus: string | null
    lastRunTime: number | null
    filePath: string
  }> {
    const statuses: Array<{
      pipelineName: string
      schedule: string
      isRunning: boolean
      lastRunStatus: string | null
      lastRunTime: number | null
      filePath: string
    }> = []

    for (const [name, job] of this.jobs) {
      const schedule = job.pipeline.trigger.type === 'cron' ? job.pipeline.trigger.schedule : ''
      statuses.push({
        pipelineName: name,
        schedule,
        isRunning: job.isRunning,
        lastRunStatus: job.lastRun?.status ?? null,
        lastRunTime: job.lastRun?.startedAt ?? null,
        filePath: job.filePath,
      })
    }

    return statuses
  }

  /** Check if the scheduler is running */
  isRunning(): boolean {
    return this.running
  }

  /** Get count of active scheduled jobs */
  getJobCount(): number {
    return this.jobs.size
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private scheduleJob(pipeline: PipelineDefinition, filePath: string): void {
    if (pipeline.trigger.type !== 'cron') return

    const schedule = pipeline.trigger.schedule

    // Validate cron expression
    if (!cron.validate(schedule)) {
      this.options.onError?.(pipeline.name, new Error(`Invalid cron expression: ${schedule}`))
      return
    }

    const task = cron.schedule(schedule, () => {
      this.runPipeline(pipeline.name).catch((err) => {
        this.options.onError?.(pipeline.name, err instanceof Error ? err : new Error(String(err)))
      })
    })

    this.jobs.set(pipeline.name, {
      pipeline,
      filePath,
      task,
      isRunning: false,
      lastRun: null,
      nextRun: null,
    })
  }

  /**
   * Run a pipeline by name. Prevents concurrent runs of the same pipeline.
   */
  async runPipeline(name: string, variables?: Record<string, string>): Promise<PipelineRun | null> {
    const job = this.jobs.get(name)
    if (!job) {
      // Try to find it by discovery (for manual triggers)
      const discovered = discoverPipelines(this.options.cwd)
      const found = discovered.find(d => d.pipeline.name === name)
      if (!found) return null
      return this.executePipelineDirectly(found.pipeline, variables)
    }

    // Prevent concurrent runs
    if (job.isRunning) {
      this.options.onError?.(name, new Error(`Pipeline "${name}" is already running`))
      return null
    }

    job.isRunning = true

    try {
      const run = await this.executePipelineDirectly(job.pipeline, variables)
      job.lastRun = run
      return run
    } finally {
      job.isRunning = false
    }
  }

  private async executePipelineDirectly(
    pipeline: PipelineDefinition,
    variables?: Record<string, string>,
  ): Promise<PipelineRun> {
    const executorOptions: ExecutorOptions = {
      provider: this.options.provider,
      tools: this.options.tools,
      defaultModel: this.options.defaultModel,
      defaultMaxTokens: this.options.defaultMaxTokens,
      getSystemPrompt: this.options.getSystemPrompt,
      abortSignal: this.abortController.signal,
      variables,
      onProgress: (event) => {
        this.options.onProgress?.(pipeline.name, event)
      },
    }

    const run = await executePipeline(pipeline, executorOptions)
    this.options.onRunComplete?.(pipeline.name, run)
    return run
  }
}
