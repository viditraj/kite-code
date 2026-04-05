/**
 * NotebookEditTool — Edit Jupyter notebook cells.
 *
 * Implements the same patterns as Claude Code's NotebookEditTool:
 * - Replace, insert, or delete cells in .ipynb files
 * - Read-before-edit validation
 * - Cell ID or numeric index lookup
 * - Preserves notebook format and metadata
 */

import { z } from 'zod'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

// ============================================================================
// Constants
// ============================================================================

export const NOTEBOOK_EDIT_TOOL_NAME = 'NotebookEdit'
const IPYNB_INDENT = 1

// ============================================================================
// Schema
// ============================================================================

const inputSchema = z.strictObject({
  notebook_path: z.string().describe(
    'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
  ),
  cell_number: z.number().int().nonnegative().describe(
    'The 0-based index of the cell to edit.',
  ),
  new_source: z.string().describe('The new source content for the cell.'),
  cell_type: z.enum(['code', 'markdown']).optional().describe(
    'The type of the cell. If not specified, keeps the current type (for replace) or defaults to code (for insert).',
  ),
  edit_mode: z.enum(['replace', 'insert', 'delete']).optional().describe(
    'The edit operation to perform. Defaults to replace.',
  ),
})

type NotebookEditInput = z.infer<typeof inputSchema>

interface NotebookEditOutput {
  new_source: string
  cell_number: number
  cell_type: string
  edit_mode: string
  error?: string
  notebook_path: string
}

// ============================================================================
// Notebook cell types
// ============================================================================

interface NotebookCell {
  cell_type: string
  source: string | string[]
  metadata?: Record<string, unknown>
  id?: string
  execution_count?: number | null
  outputs?: unknown[]
}

interface Notebook {
  nbformat: number
  nbformat_minor: number
  metadata: Record<string, unknown>
  cells: NotebookCell[]
}

// ============================================================================
// Tool definition
// ============================================================================

export const NotebookEditTool = buildTool({
  name: NOTEBOOK_EDIT_TOOL_NAME,
  searchHint: 'edit Jupyter notebook cells (.ipynb)',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => false,

  async description() {
    return 'Edit a cell in a Jupyter notebook file (.ipynb) - replace, insert, or delete cells'
  },

  async prompt() {
    return `Edit a cell in a Jupyter notebook (.ipynb) file. Supports three operations:
- replace: Replace the cell content with new source (default)
- insert: Insert a new cell at the specified position
- delete: Delete the cell at the specified position

The notebook_path must be an absolute path. The cell_number is 0-based.

Important:
- You must read the notebook before editing it (use the Read tool)
- For insert mode, the new cell is inserted at the specified index
- For delete mode, the new_source parameter is ignored but still required
- cell_type defaults to 'code' for new cells if not specified`
  },

  async validateInput(input: NotebookEditInput, context: ToolUseContext) {
    const fullPath = resolve(input.notebook_path)

    if (!fullPath.endsWith('.ipynb')) {
      return { result: false, message: 'File must be a .ipynb notebook file' }
    }

    // Read-before-edit check
    if (!context.readFileState.has(fullPath)) {
      return { result: false, message: 'You must read the notebook before editing it. Use the Read tool first.' }
    }

    const editMode = input.edit_mode ?? 'replace'

    if (editMode === 'insert' && !input.cell_type) {
      return { result: false, message: 'cell_type is required when using edit_mode=insert' }
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const notebook = JSON.parse(content) as Notebook

      if (editMode !== 'insert' && input.cell_number >= notebook.cells.length) {
        return { result: false, message: `Cell index ${input.cell_number} is out of range. Notebook has ${notebook.cells.length} cells.` }
      }
    } catch (err) {
      return { result: false, message: `Failed to read notebook: ${(err as Error).message}` }
    }

    return { result: true }
  },

  async checkPermissions(input) {
    // Delegate to general write permission system
    return { behavior: 'passthrough' as const, message: 'Notebook edit requires write permission.' }
  },

  async call(input: NotebookEditInput, context: ToolUseContext) {
    const fullPath = resolve(input.notebook_path)
    const editMode = input.edit_mode ?? 'replace'

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const notebook = JSON.parse(content) as Notebook
      const cellIndex = input.cell_number

      const cellType = input.cell_type ?? (
        editMode === 'insert' ? 'code' : notebook.cells[cellIndex]?.cell_type ?? 'code'
      )

      // Convert source to array of lines (notebook format)
      const sourceLines = input.new_source.split('\n').map((line, i, arr) =>
        i < arr.length - 1 ? line + '\n' : line,
      )

      switch (editMode) {
        case 'delete': {
          notebook.cells.splice(cellIndex, 1)
          break
        }
        case 'insert': {
          const newCell: NotebookCell = {
            cell_type: cellType,
            source: sourceLines,
            metadata: {},
          }
          // Generate cell ID for notebook format >= 4.5
          if (notebook.nbformat > 4 || (notebook.nbformat === 4 && notebook.nbformat_minor >= 5)) {
            newCell.id = randomUUID().slice(0, 8)
          }
          if (cellType === 'code') {
            newCell.execution_count = null
            newCell.outputs = []
          }
          notebook.cells.splice(cellIndex, 0, newCell)
          break
        }
        case 'replace':
        default: {
          const targetCell = notebook.cells[cellIndex]!
          targetCell.source = sourceLines
          if (input.cell_type) {
            targetCell.cell_type = input.cell_type
          }
          // Reset execution state for code cells
          if (targetCell.cell_type === 'code') {
            targetCell.execution_count = null
            targetCell.outputs = []
          }
          break
        }
      }

      // Write back
      const updatedContent = JSON.stringify(notebook, null, IPYNB_INDENT) + '\n'
      writeFileSync(fullPath, updatedContent, 'utf-8')

      // Update read file state so subsequent edits don't fail the read-before-edit check
      try {
        const st = statSync(fullPath)
        context.readFileState.set(fullPath, { mtime: st.mtimeMs })
      } catch {
        // Non-critical
      }

      return {
        data: {
          new_source: input.new_source,
          cell_number: cellIndex,
          cell_type: cellType,
          edit_mode: editMode,
          notebook_path: fullPath,
        },
      }
    } catch (err) {
      return {
        data: {
          new_source: input.new_source,
          cell_number: input.cell_number,
          cell_type: input.cell_type ?? 'code',
          edit_mode: editMode,
          error: (err as Error).message,
          notebook_path: fullPath,
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: NotebookEditOutput, toolUseID: string) {
    if (data.error) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: data.error,
        is_error: true,
      }
    }

    switch (data.edit_mode) {
      case 'replace':
        return { type: 'tool_result' as const, tool_use_id: toolUseID, content: `Updated cell ${data.cell_number} in ${data.notebook_path}` }
      case 'insert':
        return { type: 'tool_result' as const, tool_use_id: toolUseID, content: `Inserted new ${data.cell_type} cell at position ${data.cell_number} in ${data.notebook_path}` }
      case 'delete':
        return { type: 'tool_result' as const, tool_use_id: toolUseID, content: `Deleted cell ${data.cell_number} from ${data.notebook_path}` }
      default:
        return { type: 'tool_result' as const, tool_use_id: toolUseID, content: 'Unknown edit mode' }
    }
  },
})
