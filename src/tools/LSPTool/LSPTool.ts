/**
 * LSPTool — Language Server Protocol integration for code intelligence.
 *
 * Provides static analysis diagnostics by running the appropriate linter
 * based on file extension, plus stub messages for full LSP features that
 * require a running language server.
 *
 * Supported linters:
 * - TypeScript/TSX: `npx tsc --noEmit`
 * - Python: `python3 -m py_compile`
 * - JavaScript/JSX: `node --check`
 * - Rust: `cargo check --message-format=json`
 */

import { z } from 'zod'
import { execSync } from 'child_process'
import { resolve, extname, dirname } from 'path'
import { buildTool } from '../../Tool.js'

const LSP_TOOL_NAME = 'LSP'

const inputSchema = z.strictObject({
  action: z.enum(['diagnostics', 'hover', 'definition', 'references', 'completion']).describe(
    'The LSP action to perform. "diagnostics" runs static analysis; others require a running language server.'
  ),
  file_path: z.string().describe('Absolute or relative path to the file to analyze'),
  line: z.number().optional().describe('Line number (0-based) for hover/definition/references/completion'),
  character: z.number().optional().describe('Character offset (0-based) for hover/definition/references/completion'),
})

type LSPInput = z.infer<typeof inputSchema>

interface LSPOutput {
  result: string
  diagnosticCount?: number
}

/**
 * Run TypeScript diagnostics using `npx tsc --noEmit`.
 */
function runTypeScriptDiagnostics(filePath: string, cwd: string): LSPOutput {
  try {
    execSync(`npx tsc --noEmit`, {
      encoding: 'utf-8',
      cwd,
      timeout: 60_000,
      stdio: 'pipe',
    })
    return { result: `No TypeScript errors found in project.`, diagnosticCount: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    const output = (e.stdout || '') + (e.stderr || '')
    const lines = output.trim().split('\n').filter(Boolean)

    // Filter for errors related to the specific file
    const fileBasename = filePath.split('/').pop() || filePath
    const relevantLines = lines.filter(
      line => line.includes(filePath) || line.includes(fileBasename)
    )

    if (relevantLines.length > 0) {
      return {
        result: relevantLines.join('\n'),
        diagnosticCount: relevantLines.filter(l => /error TS\d+/.test(l)).length || relevantLines.length,
      }
    }

    // Return all errors if none match the specific file
    const errorCount = lines.filter(l => /error TS\d+/.test(l)).length
    if (errorCount > 0) {
      const truncated = lines.length > 50
        ? lines.slice(0, 50).join('\n') + `\n... (${lines.length} total lines, showing first 50)`
        : lines.join('\n')
      return { result: truncated, diagnosticCount: errorCount }
    }

    return { result: output.trim() || 'TypeScript check failed with no output.', diagnosticCount: 0 }
  }
}

/**
 * Run Python syntax check using `python3 -m py_compile`.
 */
function runPythonDiagnostics(filePath: string): LSPOutput {
  try {
    execSync(`python3 -m py_compile ${filePath}`, {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: 'pipe',
    })
    return { result: `No syntax errors found in ${filePath}.`, diagnosticCount: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string }
    const output = ((e.stderr || '') + (e.stdout || '')).trim()
    const errorLines = output.split('\n').filter(Boolean)
    return {
      result: output || `Python syntax check failed for ${filePath}.`,
      diagnosticCount: errorLines.length,
    }
  }
}

/**
 * Run JavaScript syntax check using `node --check`.
 */
function runJavaScriptDiagnostics(filePath: string): LSPOutput {
  try {
    execSync(`node --check ${filePath}`, {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: 'pipe',
    })
    return { result: `No syntax errors found in ${filePath}.`, diagnosticCount: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string }
    const output = ((e.stderr || '') + (e.stdout || '')).trim()
    const errorLines = output.split('\n').filter(Boolean)
    return {
      result: output || `JavaScript syntax check failed for ${filePath}.`,
      diagnosticCount: errorLines.length,
    }
  }
}

/**
 * Run Rust diagnostics using `cargo check --message-format=json`.
 */
function runRustDiagnostics(filePath: string, cwd: string): LSPOutput {
  try {
    const output = execSync(`cargo check --message-format=json 2>&1`, {
      encoding: 'utf-8',
      cwd,
      timeout: 120_000,
      stdio: 'pipe',
    })

    // Parse JSON diagnostic messages
    const lines = output.trim().split('\n').filter(Boolean)
    const diagnostics: string[] = []

    for (const line of lines) {
      try {
        const msg = JSON.parse(line)
        if (msg.reason === 'compiler-message' && msg.message) {
          const rendered = msg.message.rendered
          if (rendered) {
            diagnostics.push(rendered.trim())
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    if (diagnostics.length === 0) {
      return { result: `No Rust errors found.`, diagnosticCount: 0 }
    }

    const truncated = diagnostics.length > 20
      ? diagnostics.slice(0, 20).join('\n\n') + `\n\n... (${diagnostics.length} total diagnostics, showing first 20)`
      : diagnostics.join('\n\n')

    return { result: truncated, diagnosticCount: diagnostics.length }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string }
    const output = ((e.stdout || '') + (e.stderr || '')).trim()

    // Try to parse JSON diagnostics from error output
    const lines = output.split('\n').filter(Boolean)
    const diagnostics: string[] = []

    for (const line of lines) {
      try {
        const msg = JSON.parse(line)
        if (msg.reason === 'compiler-message' && msg.message?.rendered) {
          diagnostics.push(msg.message.rendered.trim())
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    if (diagnostics.length > 0) {
      const truncated = diagnostics.length > 20
        ? diagnostics.slice(0, 20).join('\n\n') + `\n\n... (${diagnostics.length} total diagnostics, showing first 20)`
        : diagnostics.join('\n\n')
      return { result: truncated, diagnosticCount: diagnostics.length }
    }

    return {
      result: output || 'Cargo check failed with no output.',
      diagnosticCount: 1,
    }
  }
}

/**
 * Dispatch diagnostics to the appropriate linter based on file extension.
 */
function runDiagnostics(filePath: string, cwd: string): LSPOutput {
  const ext = extname(filePath).toLowerCase()

  switch (ext) {
    case '.ts':
    case '.tsx':
      return runTypeScriptDiagnostics(filePath, cwd)

    case '.py':
      return runPythonDiagnostics(filePath)

    case '.js':
    case '.jsx':
      return runJavaScriptDiagnostics(filePath)

    case '.rs':
      return runRustDiagnostics(filePath, cwd)

    default:
      return {
        result: `No linter available for this file type (${ext || 'unknown'}).`,
        diagnosticCount: 0,
      }
  }
}

const LSP_STUB_MESSAGE =
  'Full LSP requires a running language server. Use diagnostics for static analysis, or Grep/Read for code navigation.'

export const LSPTool = buildTool({
  name: LSP_TOOL_NAME,
  searchHint: 'language server diagnostics hover definition references completion linting',
  maxResultSizeChars: 20_000,
  strict: true,

  inputSchema,

  async description() {
    return 'Language server protocol integration for code intelligence — diagnostics, hover, definitions, references, and completion'
  },

  async prompt() {
    return `Provides language server protocol (LSP) integration for code intelligence.

Use the "diagnostics" action to run static analysis on a file:
- TypeScript (.ts/.tsx): runs \`npx tsc --noEmit\` and reports type errors
- Python (.py): runs \`python3 -m py_compile\` for syntax checking
- JavaScript (.js/.jsx): runs \`node --check\` for syntax validation
- Rust (.rs): runs \`cargo check --message-format=json\` and parses diagnostics

Other actions (hover, definition, references, completion) require a running language server
and will return a guidance message suggesting alternative tools.`
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return true
  },

  async checkPermissions() {
    return { behavior: 'allow' as const }
  },

  isSearchOrReadCommand() {
    return { isSearch: false, isRead: true }
  },

  toAutoClassifierInput(input: LSPInput) {
    return `lsp ${input.action} ${input.file_path}`
  },

  userFacingName() {
    return 'LSP'
  },

  getToolUseSummary(input?: Partial<LSPInput>) {
    if (!input?.action) return null
    return `action="${input.action}" file="${input.file_path || ''}"`
  },

  getActivityDescription(input?: Partial<LSPInput>) {
    if (!input?.action) return 'Running LSP'
    if (input.action === 'diagnostics') {
      return `Running diagnostics on ${input.file_path || 'file'}`
    }
    return `LSP ${input.action} on ${input.file_path || 'file'}`
  },

  async call(input: LSPInput, context: any, _canUseTool?: any, _parentMessage?: any) {
    const cwd = context.getCwd()
    const filePath = resolve(cwd, input.file_path)

    switch (input.action) {
      case 'diagnostics': {
        const result = runDiagnostics(filePath, cwd)
        return { data: result }
      }

      case 'hover':
      case 'definition':
      case 'references':
      case 'completion':
        return {
          data: {
            result: LSP_STUB_MESSAGE,
          },
        }

      default:
        return {
          data: {
            result: `Unknown LSP action: ${input.action}`,
          },
        }
    }
  },

  mapToolResultToToolResultBlockParam(data: LSPOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: data.result,
    }
  },
})

export { LSP_TOOL_NAME }
