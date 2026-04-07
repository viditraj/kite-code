/**
 * Pipeline type definitions.
 *
 * Defines the complete type system for the Kite Pipeline engine:
 * - PipelineDefinition: the user-authored YAML schema
 * - PipelineRun: runtime state for a pipeline execution
 * - StageResult: per-stage outcome
 * - PipelineTrigger: scheduling and event triggers
 */

// ============================================================================
// Pipeline Definition (user-authored, parsed from YAML)
// ============================================================================

export interface PipelineDefinition {
  /** Unique pipeline name (kebab-case, used as identifier) */
  name: string
  /** Human-readable description */
  description?: string
  /** How/when the pipeline is triggered */
  trigger: PipelineTrigger
  /** Global settings for all stages */
  settings?: PipelineSettings
  /** Ordered list of stages to execute */
  stages: PipelineStage[]
  /** What to do when a non-optional stage fails */
  onFailure?: 'stop' | 'continue' | 'retry'
  /** Default retry count per stage (0 = no retries) */
  retries?: number
  /** Notification config on failure */
  notifyOnFailure?: NotifyConfig
}

// ============================================================================
// Trigger types
// ============================================================================

export type PipelineTrigger =
  | { type: 'cron'; schedule: string }
  | { type: 'webhook'; secret?: string; path?: string }
  | { type: 'manual' }
  | { type: 'file-watch'; paths: string[]; debounceMs?: number }

// ============================================================================
// Pipeline settings (global defaults for all stages)
// ============================================================================

export interface PipelineSettings {
  /** LLM model override for this pipeline */
  model?: string
  /** Max agent turns per stage (default: 50) */
  maxTurns?: number
  /** Permission mode for headless execution (default: bypassPermissions) */
  permissionMode?: string
  /** Maximum cost in USD for the entire run (0 = unlimited) */
  maxCostUsd?: number
  /** Working directory for tool execution */
  cwd?: string
  /** Environment variables (supports ${ENV_VAR} expansion) */
  env?: Record<string, string>
  /** LLM provider override */
  provider?: string
  /** Max output tokens per stage */
  maxTokens?: number
}

// ============================================================================
// Stage definition
// ============================================================================

export interface PipelineStage {
  /** Unique stage name within the pipeline */
  name: string
  /** The LLM prompt for this stage (supports {{ }} interpolation) */
  prompt: string
  /** Tool whitelist — only these tools are available (default: all) */
  tools?: string[]
  /** Agent type to use: Explore (read-only), Plan, or omit for general-purpose */
  agent?: 'Explore' | 'Plan' | string
  /** Skip this stage if condition evaluates to empty/falsy */
  condition?: string
  /** Halt the entire pipeline if stage output contains this string */
  stopIf?: string
  /** If true, failure of this stage does not halt the pipeline */
  optional?: boolean
  /** Timeout in ms for this stage (default: 300000 = 5min) */
  timeout?: number
  /** Retry count override for this stage */
  retries?: number
  /** Model override for this stage */
  model?: string
  /** Max turns override for this stage */
  maxTurns?: number
  /** System prompt override or appendage for this stage */
  systemPrompt?: string
}

// ============================================================================
// Pipeline run (runtime state)
// ============================================================================

export type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'stopped' | 'cancelled'
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'stopped'

export interface PipelineRun {
  /** Unique run ID (UUID) */
  id: string
  /** Name of the pipeline being run */
  pipelineName: string
  /** What triggered this run */
  trigger: 'cron' | 'webhook' | 'manual' | 'file-watch'
  /** Overall run status */
  status: PipelineRunStatus
  /** Per-stage results keyed by stage name */
  stages: Record<string, StageResult>
  /** When the run started (epoch ms) */
  startedAt: number
  /** When the run completed (epoch ms) */
  completedAt?: number
  /** Total estimated cost in USD */
  totalCostUsd: number
  /** Error message if the run failed */
  error?: string
  /** Variable overrides passed at invocation */
  variables?: Record<string, string>
}

export interface StageResult {
  /** Stage execution status */
  status: StageStatus
  /** Assistant text output from the stage */
  output: string
  /** Error message if the stage failed */
  error?: string
  /** When this stage started (epoch ms) */
  startedAt?: number
  /** When this stage completed (epoch ms) */
  completedAt?: number
  /** Estimated cost in USD for this stage */
  costUsd: number
  /** Number of agent turns used */
  turnCount: number
  /** Which attempt this is (1-based, >1 means retry) */
  attempt: number
}

// ============================================================================
// Notification config
// ============================================================================

export interface NotifyConfig {
  /** Notification channel type */
  type: 'webhook' | 'command'
  /** Webhook URL to POST failure details to */
  url?: string
  /** Shell command to execute on failure */
  command?: string
  /** Additional headers for webhook */
  headers?: Record<string, string>
}

// ============================================================================
// Factory helpers
// ============================================================================

export function createEmptyStageResult(): StageResult {
  return {
    status: 'pending',
    output: '',
    costUsd: 0,
    turnCount: 0,
    attempt: 1,
  }
}

export function createPipelineRun(
  pipelineName: string,
  trigger: PipelineRun['trigger'],
  runId: string,
  variables?: Record<string, string>,
): PipelineRun {
  return {
    id: runId,
    pipelineName,
    trigger,
    status: 'running',
    stages: {},
    startedAt: Date.now(),
    totalCostUsd: 0,
    variables,
  }
}

// ============================================================================
// Validation result
// ============================================================================

export interface PipelineValidationError {
  path: string
  message: string
}

export interface PipelineValidationResult {
  valid: boolean
  errors: PipelineValidationError[]
}
