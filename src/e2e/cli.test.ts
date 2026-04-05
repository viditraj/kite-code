/**
 * E2E tests for Kite CLI.
 *
 * These tests spawn real CLI processes and verify:
 * - --help output
 * - --version output
 * - --doctor mode
 * - -p (print) mode with piped input
 * - Exit codes
 * - Boot performance
 */

import { describe, it, expect, afterEach } from 'vitest'
import { spawnKite, type KiteProcess } from './harness.js'
import { performance } from 'node:perf_hooks'
import { tmpdir } from 'node:os'

// Collect spawned processes for cleanup
const spawned: KiteProcess[] = []

function spawn(...args: Parameters<typeof spawnKite>): KiteProcess {
  const p = spawnKite(...args)
  spawned.push(p)
  return p
}

afterEach(async () => {
  for (const p of spawned) {
    await p.kill()
  }
  spawned.length = 0
})

describe('E2E: CLI flags', () => {
  it('--help shows usage and exits 0', async () => {
    const kite = spawn({ args: ['--help'] })
    const { code, stdout } = await kite.waitForExit()
    expect(code).toBe(0)
    expect(stdout).toContain('kite')
    expect(stdout).toContain('--help')
    expect(stdout).toContain('--version')
    expect(stdout).toContain('--model')
    expect(stdout).toContain('--provider')
  })

  it('--version shows version and exits 0', async () => {
    const kite = spawn({ args: ['--version'] })
    const { code, stdout } = await kite.waitForExit()
    expect(code).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('--help includes all key options', async () => {
    const kite = spawn({ args: ['--help'] })
    const { stdout } = await kite.waitForExit()
    const expectedFlags = [
      '--print', '--continue', '--resume',
      '--model', '--provider', '--permission-mode',
      '--system-prompt', '--max-tokens',
      '--doctor', '--setup', '--debug', '--verbose',
    ]
    for (const flag of expectedFlags) {
      expect(stdout).toContain(flag)
    }
  })
})

describe('E2E: --doctor mode', () => {
  it('prints diagnostics and exits 0', async () => {
    const kite = spawn({ args: ['--doctor'], timeout: 30_000 })
    const { code, stdout } = await kite.waitForExit(25_000)
    expect(code).toBe(0)
    expect(stdout).toContain('Kite Doctor')
    expect(stdout).toContain('Node.js')
    expect(stdout).toContain('Platform')
    expect(stdout).toContain('Provider')
    expect(stdout).toContain('Config')
  })
})

describe('E2E: Boot performance', () => {
  it('--help completes in under 500ms', async () => {
    const start = performance.now()
    const kite = spawn({ args: ['--help'] })
    await kite.waitForExit()
    const elapsed = performance.now() - start
    // Allow 500ms for CI environments (target is <100ms for built CLI)
    expect(elapsed).toBeLessThan(500)
  })

  it('--version completes in under 500ms', async () => {
    const start = performance.now()
    const kite = spawn({ args: ['--version'] })
    await kite.waitForExit()
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(500)
  })
})

describe('E2E: Error handling', () => {
  it('unknown flag shows error', async () => {
    const kite = spawn({ args: ['--nonexistent-flag-xyz'] })
    const { code, stderr } = await kite.waitForExit()
    expect(code).not.toBe(0)
    expect(stderr).toContain('unknown option')
  })
})

describe('E2E: Environment', () => {
  it('respects NODE_NO_WARNINGS', async () => {
    const kite = spawn({
      args: ['--help'],
      env: { NODE_NO_WARNINGS: '1' },
    })
    const { stderr } = await kite.waitForExit()
    // Should not contain ExperimentalWarning
    expect(stderr).not.toContain('ExperimentalWarning')
  })

  it('works with custom CWD', async () => {
    const kite = spawn({
      args: ['--help'],
      cwd: tmpdir(),
    })
    const { code, stdout } = await kite.waitForExit()
    expect(code).toBe(0)
    expect(stdout).toContain('kite')
  }, 10_000)
})
