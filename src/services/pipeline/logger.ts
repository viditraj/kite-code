/**
 * Pipeline logger — JSONL-based run logging with rotation.
 *
 * Stores pipeline run history in ~/.kite/pipelines/logs/ as JSONL files.
 * Each pipeline gets its own log file. Supports:
 * - Append run results
 * - Query run history
 * - Log rotation (max entries per file, max age)
 * - Structured output for status queries
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { PipelineRun, StageResult } from './types.js'

// ============================================================================
// Constants
// ============================================================================

const LOG_DIR = join(homedir(), '.kite', 'pipelines', 'logs')
const MAX_RUNS_PER_FILE = 500
const MAX_LOG_AGE_DAYS = 90
const MAX_LOG_AGE_MS = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000

// ============================================================================
// Log entry types
// ============================================================================

export interface PipelineLogEntry {
  /** When this entry was written (ISO timestamp) */
  timestamp: string
  /** The event type */
  event: 'run_start' | 'stage_start' | 'stage_complete' | 'run_complete' | 'run_failed' | 'run_stopped'
  /** Run ID */
  runId: string
  /** Pipeline name */
  pipelineName: string
  /** Stage name (for stage events) */
  stageName?: string
  /** Stage result (for stage_complete) */
  stageResult?: StageResult
  /** Full run snapshot (for run_complete/run_failed) */
  run?: PipelineRun
  /** Error message (for failures) */
  error?: string
}

// ============================================================================
// Directory management
// ============================================================================

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

function logFilePath(pipelineName: string): string {
  // Sanitize pipeline name for filesystem
  const safe = pipelineName.replace(/[^a-z0-9-]/g, '-')
  return join(LOG_DIR, `${safe}.jsonl`)
}

// ============================================================================
// Write operations
// ============================================================================

/**
 * Append a log entry for a pipeline event.
 */
export function appendLogEntry(entry: PipelineLogEntry): void {
  ensureLogDir()
  const filePath = logFilePath(entry.pipelineName)
  const line = JSON.stringify(entry) + '\n'
  appendFileSync(filePath, line, 'utf-8')
}

/**
 * Log the start of a pipeline run.
 */
export function logRunStart(run: PipelineRun): void {
  appendLogEntry({
    timestamp: new Date().toISOString(),
    event: 'run_start',
    runId: run.id,
    pipelineName: run.pipelineName,
  })
}

/**
 * Log the start of a stage.
 */
export function logStageStart(run: PipelineRun, stageName: string): void {
  appendLogEntry({
    timestamp: new Date().toISOString(),
    event: 'stage_start',
    runId: run.id,
    pipelineName: run.pipelineName,
    stageName,
  })
}

/**
 * Log the completion of a stage.
 */
export function logStageComplete(run: PipelineRun, stageName: string, result: StageResult): void {
  appendLogEntry({
    timestamp: new Date().toISOString(),
    event: 'stage_complete',
    runId: run.id,
    pipelineName: run.pipelineName,
    stageName,
    stageResult: result,
  })
}

/**
 * Log the completion of a pipeline run (success, failure, or stop).
 */
export function logRunComplete(run: PipelineRun): void {
  const event = run.status === 'failed' ? 'run_failed'
    : run.status === 'stopped' ? 'run_stopped'
    : 'run_complete'

  appendLogEntry({
    timestamp: new Date().toISOString(),
    event,
    runId: run.id,
    pipelineName: run.pipelineName,
    run,
    error: run.error,
  })
}

// ============================================================================
// Read operations
// ============================================================================

/**
 * Read all log entries for a pipeline.
 */
export function readLogEntries(pipelineName: string): PipelineLogEntry[] {
  const filePath = logFilePath(pipelineName)
  if (!existsSync(filePath)) return []

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  const entries: PipelineLogEntry[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as PipelineLogEntry)
    } catch {
      // Skip corrupted lines
    }
  }

  return entries
}

/**
 * Get the last N completed runs for a pipeline.
 */
export function getRunHistory(pipelineName: string, limit: number = 20): PipelineRun[] {
  const entries = readLogEntries(pipelineName)
  const runs: PipelineRun[] = []

  // Collect run_complete/run_failed/run_stopped entries (they contain full run snapshots)
  for (let i = entries.length - 1; i >= 0 && runs.length < limit; i--) {
    const entry = entries[i]!
    if (entry.run && (entry.event === 'run_complete' || entry.event === 'run_failed' || entry.event === 'run_stopped')) {
      runs.push(entry.run)
    }
  }

  return runs
}

/**
 * Get a specific run by ID (supports prefix matching for short IDs).
 */
export function getRunById(pipelineName: string, runId: string): PipelineRun | null {
  const entries = readLogEntries(pipelineName)

  // Search from the end (most recent first)
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!
    // Support both exact match and prefix match (e.g., "e5cb5672" matches "e5cb5672-2e60-4d3b-...")
    if (entry.run && (entry.runId === runId || entry.runId.startsWith(runId))) {
      return entry.run
    }
  }

  return null
}

/**
 * Get run logs (all entries for a specific run).
 */
export function getRunLogs(pipelineName: string, runId: string): PipelineLogEntry[] {
  const entries = readLogEntries(pipelineName)
  return entries.filter(e => e.runId === runId)
}

// ============================================================================
// Maintenance
// ============================================================================

/**
 * Rotate log files: trim to max entries and remove old logs.
 */
export function rotateLogs(): void {
  ensureLogDir()

  const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'))
  const now = Date.now()

  for (const file of files) {
    const filePath = join(LOG_DIR, file)

    try {
      const stat = statSync(filePath)

      // Remove if too old
      if (now - stat.mtimeMs > MAX_LOG_AGE_MS) {
        unlinkSync(filePath)
        continue
      }

      // Trim if too many entries
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim().length > 0)

      if (lines.length > MAX_RUNS_PER_FILE) {
        // Keep the most recent entries
        const trimmed = lines.slice(lines.length - MAX_RUNS_PER_FILE)
        writeFileSync(filePath, trimmed.join('\n') + '\n', 'utf-8')
      }
    } catch {
      // Skip files we can't process
    }
  }
}

/**
 * Get summary statistics for all pipelines.
 */
export function getLogSummary(): Array<{
  pipelineName: string
  totalRuns: number
  lastRun: string | null
  lastStatus: string | null
}> {
  ensureLogDir()

  const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'))
  const summaries: Array<{
    pipelineName: string
    totalRuns: number
    lastRun: string | null
    lastStatus: string | null
  }> = []

  for (const file of files) {
    const pipelineName = file.replace('.jsonl', '')
    const filePath = join(LOG_DIR, file)

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim().length > 0)

      let totalRuns = 0
      let lastRun: string | null = null
      let lastStatus: string | null = null

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as PipelineLogEntry
          if (entry.event === 'run_complete' || entry.event === 'run_failed' || entry.event === 'run_stopped') {
            totalRuns++
            lastRun = entry.timestamp
            lastStatus = entry.run?.status ?? entry.event
          }
        } catch {
          // Skip
        }
      }

      summaries.push({ pipelineName, totalRuns, lastRun, lastStatus })
    } catch {
      // Skip
    }
  }

  return summaries
}
