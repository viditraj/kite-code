/**
 * FileEditTool — Edit files with exact string replacement.
 *
 * Implements the same patterns as Claude Code's FileEditTool.ts:
 * - Exact string replacement (old_string → new_string)
 * - Optional replace_all for multiple occurrences
 * - Validates uniqueness of old_string
 * - Not concurrency-safe, not read-only
 */
import { z } from 'zod';
declare const FILE_EDIT_TOOL_NAME = "Edit";
export declare const FileEditTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { FILE_EDIT_TOOL_NAME };
//# sourceMappingURL=FileEditTool.d.ts.map