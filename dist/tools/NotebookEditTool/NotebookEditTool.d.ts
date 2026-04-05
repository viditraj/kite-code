/**
 * NotebookEditTool — Edit Jupyter notebook cells.
 *
 * Implements the same patterns as Claude Code's NotebookEditTool:
 * - Replace, insert, or delete cells in .ipynb files
 * - Read-before-edit validation
 * - Cell ID or numeric index lookup
 * - Preserves notebook format and metadata
 */
import { z } from 'zod';
export declare const NOTEBOOK_EDIT_TOOL_NAME = "NotebookEdit";
export declare const NotebookEditTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=NotebookEditTool.d.ts.map