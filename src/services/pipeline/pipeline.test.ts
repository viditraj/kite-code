/**
 * Tests for the pipeline system: types, loader, context, logger.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

// ============================================================================
// Pipeline types tests
// ============================================================================

import {
  createEmptyStageResult,
  createPipelineRun,
} from './types.js'

describe('pipeline types', () => {
  it('createEmptyStageResult returns default values', () => {
    const result = createEmptyStageResult()
    expect(result.status).toBe('pending')
    expect(result.output).toBe('')
    expect(result.costUsd).toBe(0)
    expect(result.turnCount).toBe(0)
    expect(result.attempt).toBe(1)
  })

  it('createPipelineRun creates a valid run', () => {
    const run = createPipelineRun('test-pipeline', 'manual', 'test-run-id')
    expect(run.id).toBe('test-run-id')
    expect(run.pipelineName).toBe('test-pipeline')
    expect(run.trigger).toBe('manual')
    expect(run.status).toBe('running')
    expect(run.startedAt).toBeGreaterThan(0)
    expect(run.totalCostUsd).toBe(0)
    expect(Object.keys(run.stages)).toHaveLength(0)
  })

  it('createPipelineRun includes variables', () => {
    const run = createPipelineRun('test', 'cron', 'id', { key: 'value' })
    expect(run.variables).toEqual({ key: 'value' })
  })
})

// ============================================================================
// Pipeline context tests
// ============================================================================

import { interpolate, evaluateCondition, buildInterpolationContext } from './context.js'
import type { InterpolationContext } from './context.js'

describe('pipeline context', () => {
  const baseCtx: InterpolationContext = {
    stages: {
      'fetch-data': {
        status: 'completed',
        output: 'some fetched data',
        costUsd: 0.01,
        turnCount: 3,
        attempt: 1,
      },
      'analyze': {
        status: 'failed',
        output: 'error happened',
        error: 'timeout',
        costUsd: 0.02,
        turnCount: 5,
        attempt: 1,
      },
    },
    settings: {
      model: 'claude-sonnet-4',
      maxTurns: 50,
      cwd: '/home/user/project',
    },
    run: {
      id: 'run-123',
      trigger: 'manual',
      pipelineName: 'test-pipeline',
    },
    variables: {
      branch: 'main',
      env: 'production',
    },
    env: {
      HOME: '/home/user',
      PATH: '/usr/bin',
    },
  }

  describe('interpolate', () => {
    it('resolves stage output', () => {
      const result = interpolate('Data: {{ stages.fetch-data.output }}', baseCtx)
      expect(result).toBe('Data: some fetched data')
    })

    it('resolves stage status', () => {
      const result = interpolate('Status: {{ stages.analyze.status }}', baseCtx)
      expect(result).toBe('Status: failed')
    })

    it('resolves settings values', () => {
      const result = interpolate('Model: {{ settings.model }}', baseCtx)
      expect(result).toBe('Model: claude-sonnet-4')
    })

    it('resolves run metadata', () => {
      const result = interpolate('Run: {{ run.id }}', baseCtx)
      expect(result).toBe('Run: run-123')
    })

    it('resolves variables', () => {
      const result = interpolate('Branch: {{ variables.branch }}', baseCtx)
      expect(result).toBe('Branch: main')
    })

    it('resolves env vars', () => {
      const result = interpolate('Home: {{ env.HOME }}', baseCtx)
      expect(result).toBe('Home: /home/user')
    })

    it('handles multiple interpolations', () => {
      const result = interpolate(
        '{{ stages.fetch-data.status }} on {{ settings.model }}',
        baseCtx,
      )
      expect(result).toBe('completed on claude-sonnet-4')
    })

    it('leaves unresolved expressions as-is', () => {
      const result = interpolate('{{ stages.nonexistent.output }}', baseCtx)
      expect(result).toBe('{{ stages.nonexistent.output }}')
    })

    it('handles whitespace in expressions', () => {
      const result = interpolate('{{  stages.fetch-data.output  }}', baseCtx)
      expect(result).toBe('some fetched data')
    })

    it('returns template unchanged with no expressions', () => {
      const result = interpolate('no templates here', baseCtx)
      expect(result).toBe('no templates here')
    })

    it('handles numeric values', () => {
      const result = interpolate('Turns: {{ stages.fetch-data.turnCount }}', baseCtx)
      expect(result).toBe('Turns: 3')
    })
  })

  describe('evaluateCondition', () => {
    it('returns true for truthy string', () => {
      expect(evaluateCondition('true', baseCtx)).toBe(true)
    })

    it('returns false for "false"', () => {
      expect(evaluateCondition('false', baseCtx)).toBe(false)
    })

    it('returns false for "0"', () => {
      expect(evaluateCondition('0', baseCtx)).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(evaluateCondition('', baseCtx)).toBe(false)
    })

    it('evaluates resolved template as truthy', () => {
      expect(evaluateCondition('{{ stages.fetch-data.output }}', baseCtx)).toBe(true)
    })

    it('evaluates unresolved template as falsy', () => {
      expect(evaluateCondition('{{ stages.missing.output }}', baseCtx)).toBe(false)
    })

    it('supports equality comparison', () => {
      expect(evaluateCondition('{{ stages.fetch-data.status }} == completed', baseCtx)).toBe(true)
    })

    it('supports inequality comparison', () => {
      expect(evaluateCondition('{{ stages.fetch-data.status }} != failed', baseCtx)).toBe(true)
    })

    it('supports negation', () => {
      expect(evaluateCondition('!false', baseCtx)).toBe(true)
      expect(evaluateCondition('!true', baseCtx)).toBe(false)
    })
  })

  describe('buildInterpolationContext', () => {
    it('builds context from run and settings', () => {
      const run = createPipelineRun('my-pipeline', 'cron', 'run-abc')
      const ctx = buildInterpolationContext(run, { model: 'gpt-4o' })
      expect(ctx.run.pipelineName).toBe('my-pipeline')
      expect(ctx.run.trigger).toBe('cron')
      expect(ctx.settings.model).toBe('gpt-4o')
    })
  })
})

// ============================================================================
// Pipeline loader tests
// ============================================================================

import {
  loadPipelineFromString,
  validatePipeline,
  parsePipelineYaml,
  expandEnvVars,
  discoverPipelines,
} from './loader.js'

describe('pipeline loader', () => {
  describe('expandEnvVars', () => {
    it('expands ${VAR}', () => {
      process.env.TEST_PIPELINE_VAR = 'hello'
      expect(expandEnvVars('value: ${TEST_PIPELINE_VAR}')).toBe('value: hello')
      delete process.env.TEST_PIPELINE_VAR
    })

    it('expands ${VAR:-default}', () => {
      expect(expandEnvVars('${NONEXISTENT_VAR:-fallback}')).toBe('fallback')
    })

    it('uses extraEnv', () => {
      expect(expandEnvVars('${MY_VAR}', { MY_VAR: 'custom' })).toBe('custom')
    })

    it('leaves unresolved vars as-is', () => {
      const result = expandEnvVars('${DEFINITELY_NOT_SET_12345}')
      expect(result).toBe('${DEFINITELY_NOT_SET_12345}')
    })
  })

  describe('validatePipeline', () => {
    it('validates a minimal valid pipeline', () => {
      const result = validatePipeline({
        name: 'my-pipeline',
        trigger: { type: 'manual' },
        stages: [
          { name: 'step-1', prompt: 'Do something' },
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects missing name', () => {
      const result = validatePipeline({
        trigger: { type: 'manual' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.path === 'name')).toBe(true)
    })

    it('rejects invalid name format', () => {
      const result = validatePipeline({
        name: 'Invalid Name With Spaces',
        trigger: { type: 'manual' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects missing trigger', () => {
      const result = validatePipeline({
        name: 'test',
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.path === 'trigger')).toBe(true)
    })

    it('rejects invalid trigger type', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'invalid' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(false)
    })

    it('validates cron trigger schedule', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'cron', schedule: '0 */2 * * *' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(true)
    })

    it('rejects invalid cron expression', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'cron', schedule: 'not a cron' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects empty stages', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'manual' },
        stages: [],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects duplicate stage names', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'manual' },
        stages: [
          { name: 'step-1', prompt: 'Do A' },
          { name: 'step-1', prompt: 'Do B' },
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true)
    })

    it('rejects stage with empty prompt', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'manual' },
        stages: [{ name: 'step-1', prompt: '  ' }],
      })
      expect(result.valid).toBe(false)
    })

    it('validates settings', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'manual' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
        settings: { maxTurns: -1 },
      })
      expect(result.valid).toBe(false)
    })

    it('validates onFailure', () => {
      const result = validatePipeline({
        name: 'test',
        trigger: { type: 'manual' },
        stages: [{ name: 'step-1', prompt: 'Do something' }],
        onFailure: 'invalid' as any,
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('loadPipelineFromString', () => {
    it('parses valid YAML', () => {
      const yaml = `
name: test-pipeline
trigger:
  type: manual
stages:
  - name: hello
    prompt: Say hello
`
      const result = loadPipelineFromString(yaml)
      expect(result.validation.valid).toBe(true)
      expect(result.pipeline).not.toBeNull()
      expect(result.pipeline!.name).toBe('test-pipeline')
      expect(result.pipeline!.stages).toHaveLength(1)
      expect(result.pipeline!.stages[0]!.name).toBe('hello')
    })

    it('parses pipeline with all fields', () => {
      const yaml = `
name: full-pipeline
description: A comprehensive pipeline
trigger:
  type: cron
  schedule: "0 */2 * * *"
settings:
  model: gpt-4o
  maxTurns: 30
  permissionMode: bypassPermissions
  maxCostUsd: 5.0
  cwd: /home/user
stages:
  - name: fetch
    prompt: Fetch data from API
    tools: [HttpRequest, Bash]
    timeout: 60000
  - name: process
    prompt: Process {{ stages.fetch.output }}
    condition: "{{ stages.fetch.status }} == completed"
    optional: true
onFailure: continue
retries: 2
`
      const result = loadPipelineFromString(yaml)
      expect(result.validation.valid).toBe(true)
      expect(result.pipeline!.stages).toHaveLength(2)
      expect(result.pipeline!.settings!.model).toBe('gpt-4o')
      expect(result.pipeline!.onFailure).toBe('continue')
      expect(result.pipeline!.retries).toBe(2)
    })

    it('returns errors for invalid YAML', () => {
      const yaml = `
name: 123-bad-name
stages: not-an-array
`
      const result = loadPipelineFromString(yaml)
      expect(result.validation.valid).toBe(false)
      expect(result.pipeline).toBeNull()
    })

    it('expands env vars in YAML', () => {
      process.env.TEST_MODEL_NAME = 'claude-opus'
      const yaml = `
name: env-test
trigger:
  type: manual
settings:
  model: \${TEST_MODEL_NAME}
stages:
  - name: step
    prompt: Use model
`
      const result = loadPipelineFromString(yaml)
      expect(result.validation.valid).toBe(true)
      expect(result.pipeline!.settings!.model).toBe('claude-opus')
      delete process.env.TEST_MODEL_NAME
    })
  })

  describe('discoverPipelines', () => {
    const testDir = join(tmpdir(), `kite-pipeline-test-${randomUUID().slice(0, 8)}`)
    const pipelineDir = join(testDir, '.kite', 'pipelines')

    beforeEach(() => {
      mkdirSync(pipelineDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it('discovers pipelines from .kite/pipelines/', () => {
      writeFileSync(join(pipelineDir, 'test.yaml'), `
name: discovered
trigger:
  type: manual
stages:
  - name: step
    prompt: Hello
`)
      const pipelines = discoverPipelines(testDir)
      expect(pipelines.length).toBeGreaterThanOrEqual(1)
      expect(pipelines.some(p => p.pipeline.name === 'discovered')).toBe(true)
    })

    it('skips invalid files', () => {
      writeFileSync(join(pipelineDir, 'valid.yaml'), `
name: good
trigger:
  type: manual
stages:
  - name: step
    prompt: Hello
`)
      writeFileSync(join(pipelineDir, 'invalid.yaml'), 'not: valid: yaml: [')
      writeFileSync(join(pipelineDir, 'readme.txt'), 'not a pipeline')

      const pipelines = discoverPipelines(testDir)
      const names = pipelines.map(p => p.pipeline.name)
      expect(names).toContain('good')
    })

    it('returns empty array for non-existent directory', () => {
      const pipelines = discoverPipelines('/tmp/nonexistent-dir-' + randomUUID())
      // May still find global pipelines, but no project-level ones
      // Just verify it doesn't throw
      expect(Array.isArray(pipelines)).toBe(true)
    })
  })
})

// ============================================================================
// Pipeline logger tests
// ============================================================================

import {
  appendLogEntry,
  readLogEntries,
  logRunStart,
  logRunComplete,
  getRunHistory,
} from './logger.js'

describe('pipeline logger', () => {
  it('can write and read log entries', () => {
    const testName = `test-logger-${randomUUID().slice(0, 8)}`
    const entry = {
      timestamp: new Date().toISOString(),
      event: 'run_start' as const,
      runId: 'test-run-1',
      pipelineName: testName,
    }

    appendLogEntry(entry)
    const entries = readLogEntries(testName)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries.some(e => e.runId === 'test-run-1')).toBe(true)
  })

  it('returns empty array for unknown pipeline', () => {
    const entries = readLogEntries('nonexistent-pipeline-' + randomUUID())
    expect(entries).toHaveLength(0)
  })

  it('logRunStart and logRunComplete work together', () => {
    const testName = `test-lifecycle-${randomUUID().slice(0, 8)}`
    const run = createPipelineRun(testName, 'manual', randomUUID())
    run.status = 'completed'
    run.completedAt = Date.now()

    logRunStart(run)
    logRunComplete(run)

    const history = getRunHistory(testName, 10)
    expect(history.length).toBe(1)
    expect(history[0]!.status).toBe('completed')
  })
})
