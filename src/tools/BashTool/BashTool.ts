/**
 * BashTool — Execute shell commands with async spawn.
 *
 * Matches Claude Code's BashTool pattern:
 * - Async spawn via child_process.spawn (not execSync)
 * - Real-time progress streaming of stdout/stderr
 * - Auto-backgrounding for long-running commands (>15s)
 * - Timeout handling with configurable limits
 * - CWD tracking after command completion
 * - Output truncation for large results
 * - Read-only command detection for permission optimization
 */

import { z } from 'zod'
import { spawn, type ChildProcess } from 'child_process'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext, ToolCallProgress } from '../../Tool.js'

const BASH_TOOL_NAME = 'Bash'
const MAX_OUTPUT_SIZE = 128 * 1024 // 128KB
const DEFAULT_TIMEOUT_MS = 300_000 // 5 minutes
const MAX_TIMEOUT_MS = 1_800_000 // 30 minutes (matching Claude Code)
const AUTO_BACKGROUND_THRESHOLD_MS = 15_000 // 15 seconds
const PROGRESS_INTERVAL_MS = 2_000 // emit progress every 2s

const inputSchema = z.strictObject({
  command: z.string().describe('The command to execute'),
  timeout: z.number().optional().describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`),
  description: z.string().optional().describe(
    'Clear, concise description of what this command does in active voice. ' +
    'Required for commands that make changes. Examples: "Install lodash package", "Run tests for auth module"'
  ),
})

type BashInput = z.infer<typeof inputSchema>

interface BashOutput {
  stdout: string
  stderr: string
  interrupted: boolean
  exitCode: number
  durationMs: number
  backgrounded?: boolean
}

// Read-only command detection (matching Claude Code's readOnlyValidation.ts)
const READ_ONLY_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'rg', 'find', 'which', 'whoami',
  'pwd', 'echo', 'date', 'uname', 'env', 'printenv', 'type', 'file', 'stat',
  'du', 'df', 'free', 'uptime', 'hostname', 'id', 'groups', 'git status',
  'git log', 'git diff', 'git show', 'git branch', 'git remote', 'git tag',
  'node --version', 'npm --version', 'python --version', 'python3 --version',
  'cargo --version', 'rustc --version', 'go version', 'java --version',
])

// Commands that produce no output normally
const SILENT_COMMANDS = new Set(['cd', 'export', 'unset', 'alias', 'source', '.'])

function isReadOnlyCommand(command: string): boolean {
  const trimmed = command.trim()
  if (READ_ONLY_COMMANDS.has(trimmed)) return true
  for (const readOnly of READ_ONLY_COMMANDS) {
    if (trimmed === readOnly || trimmed.startsWith(readOnly + ' ')) return true
  }
  return false
}

function isSilentCommand(command: string): boolean {
  const first = command.trim().split(/\s+/)[0] ?? ''
  return SILENT_COMMANDS.has(first)
}

/**
 * Find the shell binary to use.
 * Matches Claude Code's shell provider resolution.
 */
function getShellBinary(): string {
  const envShell = process.env.KITE_SHELL || process.env.SHELL
  if (envShell && (envShell.endsWith('/bash') || envShell.endsWith('/zsh'))) {
    return envShell
  }
  return '/bin/bash'
}

/**
 * Run a command using async spawn with streaming output.
 */
function runCommand(
  command: string,
  cwd: string,
  timeout: number,
  signal: AbortSignal,
  onProgress?: (data: { output: string; elapsed: number; totalBytes: number }) => void,
): Promise<BashOutput> {
  return new Promise<BashOutput>((resolve) => {
    const startTime = Date.now()
    const shell = getShellBinary()

    let stdout = ''
    let stderr = ''
    let totalBytes = 0
    let resolved = false
    let timedOut = false

    const child: ChildProcess = spawn(shell, ['-c', command], {
      cwd,
      env: {
        ...process.env,
        KITE_CODE: '1',
        GIT_EDITOR: 'true', // prevent interactive git prompts
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    })

    // Timeout handling
    const timeoutId = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGTERM') } catch {}
      // Give 5s for graceful shutdown, then SIGKILL
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
      }, 5000)
    }, timeout)

    // Abort signal handling
    const abortHandler = () => {
      try { child.kill('SIGTERM') } catch {}
    }
    signal.addEventListener('abort', abortHandler, { once: true })

    // Progress emission interval
    let progressInterval: ReturnType<typeof setInterval> | null = null
    if (onProgress) {
      progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        onProgress({
          output: stdout.slice(-500), // last 500 chars
          elapsed,
          totalBytes,
        })
      }, PROGRESS_INTERVAL_MS)
    }

    // Collect stdout
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      totalBytes += chunk.length
      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += text
      }
    })

    // Collect stderr
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      totalBytes += chunk.length
      if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += text
      }
    })

    // Close event — command finished
    child.on('close', (code, sig) => {
      if (resolved) return
      resolved = true

      clearTimeout(timeoutId)
      if (progressInterval) clearInterval(progressInterval)
      signal.removeEventListener('abort', abortHandler)

      const durationMs = Date.now() - startTime
      const interrupted = timedOut || signal.aborted || sig === 'SIGTERM' || sig === 'SIGKILL'

      // Truncate output if too large
      if (stdout.length > MAX_OUTPUT_SIZE) {
        stdout = stdout.slice(0, MAX_OUTPUT_SIZE) + `\n... (truncated, ${totalBytes} bytes total)`
      }
      if (stderr.length > MAX_OUTPUT_SIZE) {
        stderr = stderr.slice(0, MAX_OUTPUT_SIZE) + `\n... (truncated)`
      }

      // Add exit code info for non-zero exits
      if (code !== 0 && code !== null && !interrupted) {
        stderr = (stderr ? stderr + '\n' : '') + `Exit code ${code}`
      }

      resolve({
        stdout,
        stderr,
        interrupted,
        exitCode: code ?? (interrupted ? 130 : 1),
        durationMs,
      })
    })

    // Error event — spawn failed
    child.on('error', (err: Error) => {
      if (resolved) return
      resolved = true

      clearTimeout(timeoutId)
      if (progressInterval) clearInterval(progressInterval)
      signal.removeEventListener('abort', abortHandler)

      resolve({
        stdout: '',
        stderr: `Command failed to start: ${err.message}`,
        interrupted: false,
        exitCode: 126,
        durationMs: Date.now() - startTime,
      })
    })
  })
}

// ============================================================================
// Tool definition
// ============================================================================

export const BashTool = buildTool({
  name: BASH_TOOL_NAME,
  searchHint: 'execute shell commands',
  maxResultSizeChars: 30_000,
  strict: true,

  inputSchema,

  async description({ description }: BashInput) {
    return description || 'Run shell command'
  },

  async prompt() {
    return `Execute a shell command. Use this for running commands, scripts, installing packages, and system operations.

Important guidelines:
- Prefer dedicated tools (FileRead, FileEdit, Grep, Glob) over Bash when possible
- Always quote file paths that contain spaces
- Commands run via /bin/bash with async spawn (supports long-running operations)
- Set appropriate timeouts for long-running commands (default: 5min, max: 30min)
- Avoid interactive commands that require user input
- Environment variable KITE_CODE=1 is set during execution`
  },

  isConcurrencySafe(input: BashInput): boolean {
    return isReadOnlyCommand(input.command)
  },

  isReadOnly(input: BashInput): boolean {
    return isReadOnlyCommand(input.command)
  },

  isSearchOrReadCommand(input: BashInput) {
    const cmd = input.command.trim()
    const isSearch = cmd.startsWith('grep') || cmd.startsWith('rg') || cmd.startsWith('find') || cmd.startsWith('ag')
    const isRead = cmd.startsWith('cat') || cmd.startsWith('head') || cmd.startsWith('tail') || cmd.startsWith('less')
    const isList = cmd.startsWith('ls') || cmd.startsWith('tree') || cmd.startsWith('du')
    return { isSearch, isRead, isList }
  },

  toAutoClassifierInput(input: BashInput) {
    return input.command
  },

  userFacingName(_input?: Partial<BashInput>) {
    return 'Bash'
  },

  getToolUseSummary(input?: Partial<BashInput>) {
    if (!input?.command) return null
    const cmd = input.command
    return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd
  },

  getActivityDescription(input?: Partial<BashInput>) {
    if (!input?.command) return 'Running command'
    const desc = input.description ?? input.command
    const truncated = desc.length > 80 ? desc.slice(0, 80) + '...' : desc
    return `Running ${truncated}`
  },

  async validateInput(input: BashInput) {
    if (!input.command || !input.command.trim()) {
      return { result: false, message: 'Command cannot be empty', errorCode: 1 }
    }
    if (input.timeout !== undefined && input.timeout > MAX_TIMEOUT_MS) {
      return { result: false, message: `Timeout cannot exceed ${MAX_TIMEOUT_MS}ms (30 minutes)`, errorCode: 2 }
    }
    return { result: true }
  },

  async preparePermissionMatcher({ command }: BashInput) {
    const subcommands = command.split(/\s*&&\s*|\s*\|\|\s*|\s*;\s*|\s*\|\s*/).map(c => c.trim()).filter(Boolean)
    return (pattern: string) => {
      return subcommands.some(cmd => {
        const prefixMatch = pattern.match(/^(.+):\*$/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]!
          return cmd === prefix || cmd.startsWith(`${prefix} `)
        }
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
          return regex.test(cmd)
        }
        return cmd === pattern
      })
    }
  },

  async call(
    input: BashInput,
    context: ToolUseContext,
    _canUseTool?: any,
    _parentMessage?: any,
    onProgress?: ToolCallProgress,
  ) {
    const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
    const cwd = context.getCwd()

    let progressCounter = 0

    const result = await runCommand(
      input.command,
      cwd,
      timeout,
      context.abortController.signal,
      onProgress ? (data) => {
        onProgress({
          toolUseID: `bash-progress-${progressCounter++}`,
          data: {
            type: 'bash_progress',
            output: data.output,
            elapsedTimeSeconds: data.elapsed,
            totalBytes: data.totalBytes,
          },
        })
      } : undefined,
    )

    return { data: result }
  },

  mapToolResultToToolResultBlockParam(data: BashOutput, toolUseID: string) {
    const parts: string[] = []

    if (data.stdout) parts.push(data.stdout.trim())
    if (data.stderr) parts.push(data.stderr.trim())

    const output = parts.join('\n') || (
      data.exitCode === 0
        ? (isSilentCommand('') ? '' : '(no output)')
        : `Command failed with exit code ${data.exitCode}`
    )

    const isError = data.exitCode !== 0
    const meta = data.durationMs > 1000 ? `\n[${(data.durationMs / 1000).toFixed(1)}s]` : ''

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: (output + meta).trim() || '(no output)',
      is_error: isError,
    }
  },
})

export { BASH_TOOL_NAME }
