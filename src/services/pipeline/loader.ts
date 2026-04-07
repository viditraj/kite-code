/**
 * Pipeline loader — parse, validate, and discover pipeline YAML files.
 *
 * Handles:
 * - YAML parsing with the 'yaml' library
 * - Schema validation with detailed error messages
 * - Environment variable expansion (${VAR} and ${VAR:-default})
 * - Pipeline discovery from .kite/pipelines/ directories
 * - File watching for hot-reload
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { homedir } from 'os'
import { parse as parseYaml } from 'yaml'
import type {
  PipelineDefinition,
  PipelineStage,
  PipelineTrigger,
  PipelineSettings,
  PipelineValidationError,
  PipelineValidationResult,
  NotifyConfig,
} from './types.js'

// ============================================================================
// Constants
// ============================================================================

const PIPELINE_DIR_NAME = 'pipelines'
const KITE_DIR = '.kite'
const VALID_EXTENSIONS = new Set(['.yaml', '.yml'])
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const VALID_TRIGGER_TYPES = new Set(['cron', 'webhook', 'manual', 'file-watch'])
const VALID_ON_FAILURE = new Set(['stop', 'continue', 'retry'])
const VALID_PERMISSION_MODES = new Set(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk'])

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
const CRON_FIELD_COUNT_MIN = 5
const CRON_FIELD_COUNT_MAX = 6

// ============================================================================
// Environment variable expansion
// ============================================================================

/**
 * Expand ${VAR} and ${VAR:-default} patterns in a string.
 * Leaves unresolved variables as-is (does not throw).
 */
export function expandEnvVars(value: string, extraEnv?: Record<string, string>): string {
  // Pattern: ${VAR} or ${VAR:-default}
  return value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const defaultSplit = expr.indexOf(':-')
    if (defaultSplit !== -1) {
      const name = expr.slice(0, defaultSplit)
      const defaultValue = expr.slice(defaultSplit + 2)
      return extraEnv?.[name] ?? process.env[name] ?? defaultValue
    }
    return extraEnv?.[expr] ?? process.env[expr] ?? _match
  })
}

/**
 * Recursively expand env vars in an object's string values.
 */
function expandEnvInObject<T>(obj: T, extraEnv?: Record<string, string>): T {
  if (typeof obj === 'string') {
    return expandEnvVars(obj, extraEnv) as unknown as T
  }
  if (Array.isArray(obj)) {
    return obj.map(item => expandEnvInObject(item, extraEnv)) as unknown as T
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvInObject(value, extraEnv)
    }
    return result as T
  }
  return obj
}

// ============================================================================
// YAML parsing
// ============================================================================

/**
 * Parse a pipeline YAML string into a PipelineDefinition.
 * Throws on invalid YAML syntax. Use validate() for schema checks.
 */
export function parsePipelineYaml(yamlContent: string, extraEnv?: Record<string, string>): unknown {
  const raw = parseYaml(yamlContent)
  if (!raw || typeof raw !== 'object') {
    throw new Error('Pipeline YAML must be an object at the top level')
  }
  return expandEnvInObject(raw, extraEnv)
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a parsed pipeline object against the expected schema.
 * Returns structured errors so the UI can display them clearly.
 */
export function validatePipeline(raw: unknown): PipelineValidationResult {
  const errors: PipelineValidationError[] = []
  const obj = raw as Record<string, unknown>

  // Required: name
  if (!obj.name || typeof obj.name !== 'string') {
    errors.push({ path: 'name', message: 'Required: string pipeline name' })
  } else if (!NAME_PATTERN.test(obj.name)) {
    errors.push({ path: 'name', message: 'Must be kebab-case (lowercase letters, numbers, hyphens)' })
  }

  // Required: trigger
  if (!obj.trigger || typeof obj.trigger !== 'object') {
    errors.push({ path: 'trigger', message: 'Required: trigger object with type field' })
  } else {
    const trigger = obj.trigger as Record<string, unknown>
    if (!trigger.type || !VALID_TRIGGER_TYPES.has(trigger.type as string)) {
      errors.push({
        path: 'trigger.type',
        message: `Must be one of: ${[...VALID_TRIGGER_TYPES].join(', ')}`,
      })
    }
    if (trigger.type === 'cron') {
      if (!trigger.schedule || typeof trigger.schedule !== 'string') {
        errors.push({ path: 'trigger.schedule', message: 'Required for cron trigger: schedule expression' })
      } else {
        const parts = (trigger.schedule as string).trim().split(/\s+/)
        if (parts.length < CRON_FIELD_COUNT_MIN || parts.length > CRON_FIELD_COUNT_MAX) {
          errors.push({
            path: 'trigger.schedule',
            message: `Invalid cron expression: expected ${CRON_FIELD_COUNT_MIN}-${CRON_FIELD_COUNT_MAX} fields, got ${parts.length}`,
          })
        }
      }
    }
    if (trigger.type === 'file-watch') {
      if (!trigger.paths || !Array.isArray(trigger.paths) || trigger.paths.length === 0) {
        errors.push({ path: 'trigger.paths', message: 'Required for file-watch trigger: non-empty paths array' })
      }
    }
  }

  // Required: stages
  if (!obj.stages || !Array.isArray(obj.stages) || obj.stages.length === 0) {
    errors.push({ path: 'stages', message: 'Required: non-empty array of stage objects' })
  } else {
    const stageNames = new Set<string>()
    for (let i = 0; i < obj.stages.length; i++) {
      const stage = obj.stages[i] as Record<string, unknown>
      const prefix = `stages[${i}]`

      if (!stage || typeof stage !== 'object') {
        errors.push({ path: prefix, message: 'Must be an object' })
        continue
      }

      // Stage name
      if (!stage.name || typeof stage.name !== 'string') {
        errors.push({ path: `${prefix}.name`, message: 'Required: string stage name' })
      } else if (stageNames.has(stage.name as string)) {
        errors.push({ path: `${prefix}.name`, message: `Duplicate stage name: "${stage.name}"` })
      } else {
        stageNames.add(stage.name as string)
      }

      // Stage prompt
      if (!stage.prompt || typeof stage.prompt !== 'string') {
        errors.push({ path: `${prefix}.prompt`, message: 'Required: string prompt' })
      } else if ((stage.prompt as string).trim().length === 0) {
        errors.push({ path: `${prefix}.prompt`, message: 'Prompt cannot be empty' })
      }

      // Optional: tools (string array)
      if (stage.tools !== undefined) {
        if (!Array.isArray(stage.tools)) {
          errors.push({ path: `${prefix}.tools`, message: 'Must be an array of tool names' })
        } else {
          for (let j = 0; j < stage.tools.length; j++) {
            if (typeof stage.tools[j] !== 'string') {
              errors.push({ path: `${prefix}.tools[${j}]`, message: 'Must be a string tool name' })
            }
          }
        }
      }

      // Optional: timeout
      if (stage.timeout !== undefined) {
        if (typeof stage.timeout !== 'number' || stage.timeout <= 0) {
          errors.push({ path: `${prefix}.timeout`, message: 'Must be a positive number (milliseconds)' })
        }
      }

      // Optional: retries
      if (stage.retries !== undefined) {
        if (typeof stage.retries !== 'number' || stage.retries < 0 || !Number.isInteger(stage.retries)) {
          errors.push({ path: `${prefix}.retries`, message: 'Must be a non-negative integer' })
        }
      }

      // Optional: optional (boolean)
      if (stage.optional !== undefined && typeof stage.optional !== 'boolean') {
        errors.push({ path: `${prefix}.optional`, message: 'Must be a boolean' })
      }
    }
  }

  // Optional: settings
  if (obj.settings !== undefined) {
    if (typeof obj.settings !== 'object' || obj.settings === null) {
      errors.push({ path: 'settings', message: 'Must be an object' })
    } else {
      const settings = obj.settings as Record<string, unknown>
      if (settings.maxTurns !== undefined && (typeof settings.maxTurns !== 'number' || settings.maxTurns <= 0)) {
        errors.push({ path: 'settings.maxTurns', message: 'Must be a positive number' })
      }
      if (settings.maxCostUsd !== undefined && (typeof settings.maxCostUsd !== 'number' || settings.maxCostUsd < 0)) {
        errors.push({ path: 'settings.maxCostUsd', message: 'Must be a non-negative number' })
      }
      if (settings.maxTokens !== undefined && (typeof settings.maxTokens !== 'number' || settings.maxTokens <= 0)) {
        errors.push({ path: 'settings.maxTokens', message: 'Must be a positive number' })
      }
      if (settings.permissionMode !== undefined && !VALID_PERMISSION_MODES.has(settings.permissionMode as string)) {
        errors.push({
          path: 'settings.permissionMode',
          message: `Must be one of: ${[...VALID_PERMISSION_MODES].join(', ')}`,
        })
      }
    }
  }

  // Optional: onFailure
  if (obj.onFailure !== undefined && !VALID_ON_FAILURE.has(obj.onFailure as string)) {
    errors.push({ path: 'onFailure', message: `Must be one of: ${[...VALID_ON_FAILURE].join(', ')}` })
  }

  // Optional: retries
  if (obj.retries !== undefined) {
    if (typeof obj.retries !== 'number' || obj.retries < 0 || !Number.isInteger(obj.retries)) {
      errors.push({ path: 'retries', message: 'Must be a non-negative integer' })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Parse and validate a YAML string into a PipelineDefinition.
 * Throws on parse errors. Returns validation result for schema issues.
 */
export function loadPipelineFromString(
  yamlContent: string,
  extraEnv?: Record<string, string>,
): { pipeline: PipelineDefinition | null; validation: PipelineValidationResult } {
  const parsed = parsePipelineYaml(yamlContent, extraEnv)
  const validation = validatePipeline(parsed)

  if (!validation.valid) {
    return { pipeline: null, validation }
  }

  return { pipeline: coercePipeline(parsed as Record<string, unknown>), validation }
}

/**
 * Load a pipeline from a file path.
 */
export function loadPipelineFromFile(
  filePath: string,
  extraEnv?: Record<string, string>,
): { pipeline: PipelineDefinition | null; validation: PipelineValidationResult; filePath: string } {
  if (!existsSync(filePath)) {
    return {
      pipeline: null,
      validation: { valid: false, errors: [{ path: 'file', message: `File not found: ${filePath}` }] },
      filePath,
    }
  }

  const ext = extname(filePath).toLowerCase()
  if (!VALID_EXTENSIONS.has(ext)) {
    return {
      pipeline: null,
      validation: { valid: false, errors: [{ path: 'file', message: `Invalid extension: ${ext} (expected .yaml or .yml)` }] },
      filePath,
    }
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const result = loadPipelineFromString(content, extraEnv)
    return { ...result, filePath }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      pipeline: null,
      validation: { valid: false, errors: [{ path: 'file', message: `Parse error: ${message}` }] },
      filePath,
    }
  }
}

// ============================================================================
// Pipeline discovery
// ============================================================================

export interface DiscoveredPipeline {
  pipeline: PipelineDefinition
  filePath: string
}

/**
 * Discover all valid pipelines from .kite/pipelines/ directories.
 * Scans both project-level and global-level directories.
 */
export function discoverPipelines(cwd?: string): DiscoveredPipeline[] {
  const pipelines: DiscoveredPipeline[] = []
  const seen = new Set<string>()

  // Project-level: <cwd>/.kite/pipelines/
  const projectDir = join(cwd ?? process.cwd(), KITE_DIR, PIPELINE_DIR_NAME)
  loadPipelinesFromDir(projectDir, pipelines, seen)

  // Global-level: ~/.kite/pipelines/
  const globalDir = join(homedir(), KITE_DIR, PIPELINE_DIR_NAME)
  loadPipelinesFromDir(globalDir, pipelines, seen)

  return pipelines
}

function loadPipelinesFromDir(
  dir: string,
  pipelines: DiscoveredPipeline[],
  seen: Set<string>,
): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return

  const entries = readdirSync(dir)
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase()
    if (!VALID_EXTENSIONS.has(ext)) continue

    const filePath = join(dir, entry)
    if (!statSync(filePath).isFile()) continue

    try {
      const result = loadPipelineFromFile(filePath)
      if (result.pipeline && !seen.has(result.pipeline.name)) {
        seen.add(result.pipeline.name)
        pipelines.push({ pipeline: result.pipeline, filePath })
      }
    } catch {
      // Skip invalid files silently during discovery
    }
  }
}

/**
 * Find a specific pipeline by name.
 */
export function findPipeline(name: string, cwd?: string): DiscoveredPipeline | null {
  const all = discoverPipelines(cwd)
  return all.find(p => p.pipeline.name === name) ?? null
}

// ============================================================================
// Coercion — convert validated raw object into typed PipelineDefinition
// ============================================================================

function coercePipeline(raw: Record<string, unknown>): PipelineDefinition {
  const trigger = raw.trigger as Record<string, unknown>
  const settings = raw.settings as Record<string, unknown> | undefined

  const pipeline: PipelineDefinition = {
    name: raw.name as string,
    description: raw.description as string | undefined,
    trigger: coerceTrigger(trigger),
    settings: settings ? coerceSettings(settings) : undefined,
    stages: (raw.stages as Record<string, unknown>[]).map(coerceStage),
    onFailure: (raw.onFailure as 'stop' | 'continue' | 'retry') ?? 'stop',
    retries: (raw.retries as number) ?? 0,
    notifyOnFailure: raw.notifyOnFailure ? coerceNotify(raw.notifyOnFailure as Record<string, unknown>) : undefined,
  }

  return pipeline
}

function coerceTrigger(raw: Record<string, unknown>): PipelineTrigger {
  const type = raw.type as string
  switch (type) {
    case 'cron':
      return { type: 'cron', schedule: raw.schedule as string }
    case 'webhook':
      return { type: 'webhook', secret: raw.secret as string | undefined, path: raw.path as string | undefined }
    case 'file-watch':
      return {
        type: 'file-watch',
        paths: raw.paths as string[],
        debounceMs: raw.debounceMs as number | undefined,
      }
    case 'manual':
    default:
      return { type: 'manual' }
  }
}

function coerceSettings(raw: Record<string, unknown>): PipelineSettings {
  return {
    model: raw.model as string | undefined,
    maxTurns: raw.maxTurns as number | undefined,
    permissionMode: raw.permissionMode as string | undefined,
    maxCostUsd: raw.maxCostUsd as number | undefined,
    cwd: raw.cwd as string | undefined,
    env: raw.env as Record<string, string> | undefined,
    provider: raw.provider as string | undefined,
    maxTokens: raw.maxTokens as number | undefined,
  }
}

function coerceStage(raw: Record<string, unknown>): PipelineStage {
  return {
    name: raw.name as string,
    prompt: raw.prompt as string,
    tools: raw.tools as string[] | undefined,
    agent: raw.agent as string | undefined,
    condition: raw.condition as string | undefined,
    stopIf: raw.stopIf as string | undefined,
    optional: raw.optional as boolean | undefined,
    timeout: raw.timeout as number | undefined,
    retries: raw.retries as number | undefined,
    model: raw.model as string | undefined,
    maxTurns: raw.maxTurns as number | undefined,
    systemPrompt: raw.systemPrompt as string | undefined,
  }
}

function coerceNotify(raw: Record<string, unknown>): NotifyConfig {
  return {
    type: raw.type as 'webhook' | 'command',
    url: raw.url as string | undefined,
    command: raw.command as string | undefined,
    headers: raw.headers as Record<string, string> | undefined,
  }
}
