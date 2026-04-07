#!/usr/bin/env node
/**
 * Kite Pipeline Daemon — long-running scheduler process.
 *
 * Discovers cron-triggered pipelines from .kite/pipelines/ and ~/.kite/pipelines/,
 * schedules them via node-cron, and runs them headlessly via the pipeline executor.
 *
 * Usage:
 *   kite pipeline daemon          # Start the daemon (foreground)
 *   kite pipeline daemon --once   # Run all due pipelines once and exit
 *
 * The daemon:
 * - Discovers pipelines on startup and periodically re-scans
 * - Only schedules cron-triggered pipelines
 * - Prevents concurrent runs of the same pipeline
 * - Logs all runs to ~/.kite/pipelines/logs/
 * - Handles graceful shutdown on SIGINT/SIGTERM
 * - Rotates logs daily
 */

import { loadConfig } from '../utils/config.js'
import { createProvider } from '../providers/factory.js'
import { bootstrapTools } from '../bootstrap/tools.js'
import { bootstrapMCPTools } from '../bootstrap/mcp.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { PipelineScheduler } from '../services/pipeline/scheduler.js'
import type { PipelineProgressEvent } from '../services/pipeline/executor.js'
import type { PipelineRun } from '../services/pipeline/types.js'

// ============================================================================
// Formatting helpers
// ============================================================================

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function log(msg: string): void {
  process.stdout.write(`[${timestamp()}] ${msg}\n`)
}

function logError(msg: string): void {
  process.stderr.write(`[${timestamp()}] ERROR: ${msg}\n`)
}

// ============================================================================
// Main daemon function
// ============================================================================

export async function startDaemon(options?: {
  once?: boolean
  cwd?: string
  pipelineName?: string
}): Promise<void> {
  log('Kite Pipeline Daemon starting...')

  // Load config
  const config = loadConfig()
  log(`Provider: ${config.provider.name} | Model: ${config.provider.model}`)

  // Bootstrap tools
  bootstrapTools()
  const { tools, mcpToolCount } = await bootstrapMCPTools(process.cwd())
  log(`Tools loaded: ${tools.length} built-in + ${mcpToolCount} MCP`)

  // Create provider
  const provider = createProvider(config)

  // Create scheduler
  const scheduler = new PipelineScheduler({
    provider,
    tools,
    defaultModel: config.provider.model,
    defaultMaxTokens: config.behavior.maxTokens,
    getSystemPrompt,
    cwd: options?.cwd ?? process.cwd(),
    onProgress: (pipelineName: string, event: PipelineProgressEvent) => {
      switch (event.type) {
        case 'run_start':
          log(`[${pipelineName}] Run started: ${event.run.id}`)
          break
        case 'stage_start':
          log(`[${pipelineName}] Stage ${event.stageIndex + 1}/${event.totalStages}: ${event.stageName}`)
          break
        case 'stage_complete':
          log(`[${pipelineName}] Stage "${event.stageName}": ${event.result.status}${event.result.error ? ' - ' + event.result.error : ''}`)
          break
        case 'stage_skip':
          log(`[${pipelineName}] Stage skipped: ${event.stageName} (${event.reason})`)
          break
        case 'stage_retry':
          log(`[${pipelineName}] Stage "${event.stageName}" retry ${event.attempt}/${event.maxRetries}: ${event.error}`)
          break
        case 'stage_stop':
          log(`[${pipelineName}] Pipeline stopped at "${event.stageName}": ${event.reason}`)
          break
        case 'cost_warning':
          log(`[${pipelineName}] Cost warning: $${event.currentCost.toFixed(4)} / $${event.maxCost.toFixed(2)}`)
          break
      }
    },
    onRunComplete: (pipelineName: string, run: PipelineRun) => {
      const duration = run.completedAt
        ? ((run.completedAt - run.startedAt) / 1000).toFixed(1) + 's'
        : '?'
      log(`[${pipelineName}] Run ${run.status}: ${run.id} (${duration}, $${run.totalCostUsd.toFixed(4)})`)
    },
    onError: (pipelineName: string, error: Error) => {
      logError(`[${pipelineName}] ${error.message}`)
    },
  })

  // Handle --once mode: run specific or all due pipelines and exit
  if (options?.once) {
    if (options.pipelineName) {
      log(`Running pipeline "${options.pipelineName}" once...`)
      const run = await scheduler.runPipeline(options.pipelineName)
      if (!run) {
        logError(`Pipeline "${options.pipelineName}" not found`)
        process.exit(1)
      }
      log(`Done. Status: ${run.status}`)
      process.exit(run.status === 'completed' ? 0 : 1)
    }

    // Run all cron-triggered pipelines once
    scheduler.start()
    const status = scheduler.getStatus()
    log(`Found ${status.length} scheduled pipeline(s)`)

    for (const job of status) {
      log(`Running "${job.pipelineName}"...`)
      await scheduler.runPipeline(job.pipelineName)
    }

    await scheduler.stop()
    log('Done.')
    return
  }

  // Normal daemon mode: start scheduler and keep running
  scheduler.start()

  const status = scheduler.getStatus()
  log(`Scheduled ${status.length} pipeline(s):`)
  for (const job of status) {
    log(`  - ${job.pipelineName}: ${job.schedule}`)
  }

  if (status.length === 0) {
    log('No cron-triggered pipelines found. Watching for new pipelines...')
  }

  // Re-scan for new pipelines every 5 minutes
  const refreshInterval = setInterval(() => {
    scheduler.refresh()
  }, 5 * 60 * 1000)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`Received ${signal}. Shutting down...`)
    clearInterval(refreshInterval)
    await scheduler.stop()
    log('Shutdown complete.')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  log('Daemon running. Press Ctrl+C to stop.')

  // Keep the process alive
  await new Promise(() => {
    // This promise never resolves — the daemon runs until killed
  })
}
