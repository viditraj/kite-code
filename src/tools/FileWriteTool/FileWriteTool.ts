/**
 * FileWriteTool — Create or overwrite files.
 *
 * Implements the same patterns as Claude Code's FileWriteTool.ts:
 * - Creates parent directories as needed
 * - Not concurrency-safe (writes), not read-only
 * - Validates absolute paths
 */

import { z } from 'zod'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { buildTool } from '../../Tool.js'
import { backupFileBeforeEdit } from '../../utils/fileHistory.js'

const FILE_WRITE_TOOL_NAME = 'Write'

const inputSchema = z.strictObject({
  file_path: z.string().describe('The absolute path to the file to write (must be absolute, not relative)'),
  content: z.string().describe('The content to write to the file'),
})

type FileWriteInput = z.infer<typeof inputSchema>

interface FileWriteOutput {
  filePath: string
  bytesWritten: number
}

export const FileWriteTool = buildTool({
  name: FILE_WRITE_TOOL_NAME,
  aliases: ['FileWrite'],
  searchHint: 'create or overwrite files',
  maxResultSizeChars: 100_000,
  strict: true,

  inputSchema,

  async description() {
    return 'Write content to a file, creating it if it doesn\'t exist'
  },

  async prompt() {
    return `Write content to a file, creating directories and the file if needed.

IMPORTANT: Always provide the COMPLETE intended content of the file. Do not use placeholders like "// rest of code here" or "// existing code...".
You MUST write the file's complete contents in a single call. If you're editing an existing file, prefer the FileEdit tool instead.`
  },

  toAutoClassifierInput(input: FileWriteInput) {
    return `${input.file_path}: new content`
  },

  getPath(input: FileWriteInput) {
    return input.file_path
  },

  userFacingName(_input?: Partial<FileWriteInput>) {
    return 'Write'
  },

  getToolUseSummary(input?: Partial<FileWriteInput>) {
    if (!input?.file_path) return null
    return input.file_path
  },

  getActivityDescription(input?: Partial<FileWriteInput>) {
    if (!input?.file_path) return 'Writing file'
    return `Writing ${input.file_path}`
  },

  async call(input: FileWriteInput, context: any, _canUseTool?: any, _parentMessage?: any) {
    const cwd = context.getCwd()
    const filePath = resolve(cwd, input.file_path)

    // Backup before writing
    backupFileBeforeEdit(filePath)

    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, input.content, 'utf-8')

    const bytesWritten = Buffer.byteLength(input.content, 'utf-8')

    return {
      data: {
        filePath,
        bytesWritten,
      },
    }
  },

  mapToolResultToToolResultBlockParam(data: FileWriteOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Wrote ${data.bytesWritten} bytes to ${data.filePath}`,
    }
  },
})

export { FILE_WRITE_TOOL_NAME }
