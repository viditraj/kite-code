/**
 * Pipeline context — variable interpolation between stages.
 *
 * Handles {{ }} template syntax for passing data between pipeline stages:
 * - {{ stages.<name>.output }} — previous stage's assistant text
 * - {{ stages.<name>.status }} — previous stage's status
 * - {{ settings.<key> }} — pipeline settings values
 * - {{ env.<key> }} — environment variables
 * - {{ run.id }} — current run ID
 * - {{ run.trigger }} — what triggered this run
 * - {{ variables.<key> }} — runtime variable overrides
 *
 * Also evaluates conditions for stage.condition fields.
 */

import type { PipelineRun, PipelineSettings, StageResult } from './types.js'

// ============================================================================
// Interpolation context
// ============================================================================

export interface InterpolationContext {
  /** Results from previously executed stages */
  stages: Record<string, StageResult>
  /** Pipeline settings */
  settings: PipelineSettings
  /** Current run metadata */
  run: {
    id: string
    trigger: string
    pipelineName: string
  }
  /** Runtime variable overrides */
  variables: Record<string, string>
  /** Environment variables */
  env: Record<string, string>
}

/**
 * Build an interpolation context from a pipeline run and settings.
 */
export function buildInterpolationContext(
  run: PipelineRun,
  settings: PipelineSettings | undefined,
  extraEnv?: Record<string, string>,
): InterpolationContext {
  return {
    stages: run.stages,
    settings: settings ?? {},
    run: {
      id: run.id,
      trigger: run.trigger,
      pipelineName: run.pipelineName,
    },
    variables: run.variables ?? {},
    env: { ...process.env as Record<string, string>, ...extraEnv },
  }
}

// ============================================================================
// Template interpolation
// ============================================================================

/**
 * Regex for {{ expression }} patterns.
 * Matches: {{ stages.fetch.output }}, {{ settings.model }}, {{ env.TOKEN }}, etc.
 * Allows optional whitespace inside the braces.
 */
const TEMPLATE_PATTERN = /\{\{\s*(.+?)\s*\}\}/g

/**
 * Interpolate {{ }} template expressions in a string.
 *
 * Resolves dot-notation paths against the interpolation context.
 * Unresolved expressions are left as-is (no error, no empty string).
 */
export function interpolate(template: string, ctx: InterpolationContext): string {
  return template.replace(TEMPLATE_PATTERN, (_match, expr: string) => {
    const value = resolveExpression(expr.trim(), ctx)
    if (value === undefined || value === null) {
      // Leave unresolved templates as-is for transparency
      return _match
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  })
}

/**
 * Resolve a dot-notation expression against the context.
 *
 * Examples:
 *   "stages.fetch-defects.output" → ctx.stages['fetch-defects'].output
 *   "settings.model" → ctx.settings.model
 *   "env.JIRA_TOKEN" → ctx.env.JIRA_TOKEN
 *   "run.id" → ctx.run.id
 *   "variables.branch" → ctx.variables.branch
 */
function resolveExpression(expr: string, ctx: InterpolationContext): unknown {
  // Split on first dot to get the root namespace
  const dotIndex = expr.indexOf('.')
  if (dotIndex === -1) {
    // Single-level: check each namespace
    return (ctx as unknown as Record<string, unknown>)[expr]
  }

  const root = expr.slice(0, dotIndex)
  const rest = expr.slice(dotIndex + 1)

  const rootValue = (ctx as unknown as Record<string, unknown>)[root]
  if (rootValue === undefined || rootValue === null) return undefined

  return resolvePath(rootValue, rest)
}

/**
 * Resolve a dot-path within an object.
 * Handles kebab-case keys like "fetch-defects" correctly.
 */
function resolvePath(obj: unknown, path: string): unknown {
  if (obj === undefined || obj === null) return undefined
  if (path === '') return obj

  // Try exact key first (handles keys with dots in them... unlikely but safe)
  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>

    // Try the full remaining path as a single key
    if (path in record) {
      return record[path]
    }

    // Split on first dot and recurse
    const dotIndex = path.indexOf('.')
    if (dotIndex === -1) {
      return record[path]
    }

    const key = path.slice(0, dotIndex)
    const rest = path.slice(dotIndex + 1)

    if (key in record) {
      return resolvePath(record[key], rest)
    }
  }

  return undefined
}

// ============================================================================
// Condition evaluation
// ============================================================================

/**
 * Evaluate a stage condition string.
 *
 * Conditions are simple expressions that reference the interpolation context.
 * Returns true if the condition resolves to a truthy, non-empty value.
 *
 * Supports:
 * - Template expressions: "{{ stages.fetch.output }}" — truthy if non-empty
 * - Comparison: "{{ stages.fetch.status }} == completed"
 * - Negation: "!{{ stages.fetch.output }}"
 * - Plain strings: "true", "false", "1", "0"
 */
export function evaluateCondition(condition: string, ctx: InterpolationContext): boolean {
  const trimmed = condition.trim()

  // Negation
  if (trimmed.startsWith('!')) {
    return !evaluateCondition(trimmed.slice(1), ctx)
  }

  // Interpolate first
  const interpolated = interpolate(trimmed, ctx)

  // Check for comparison operators
  const eqMatch = interpolated.match(/^(.+?)\s*==\s*(.+)$/)
  if (eqMatch) {
    const left = eqMatch[1]!.trim()
    const right = eqMatch[2]!.trim()
    return left === right
  }

  const neqMatch = interpolated.match(/^(.+?)\s*!=\s*(.+)$/)
  if (neqMatch) {
    const left = neqMatch[1]!.trim()
    const right = neqMatch[2]!.trim()
    return left !== right
  }

  // Truthy check
  if (interpolated === '' || interpolated === 'false' || interpolated === '0' || interpolated === 'null' || interpolated === 'undefined') {
    return false
  }

  // If the interpolation didn't resolve (still has {{ }}), treat as false
  if (TEMPLATE_PATTERN.test(interpolated)) {
    // Reset regex lastIndex since it has the global flag
    TEMPLATE_PATTERN.lastIndex = 0
    return false
  }
  TEMPLATE_PATTERN.lastIndex = 0

  return true
}
