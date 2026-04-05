/**
 * FileWriteTool — Create or overwrite files.
 *
 * Implements the same patterns as Claude Code's FileWriteTool.ts:
 * - Creates parent directories as needed
 * - Not concurrency-safe (writes), not read-only
 * - Validates absolute paths
 */
import { z } from 'zod';
declare const FILE_WRITE_TOOL_NAME = "Write";
export declare const FileWriteTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { FILE_WRITE_TOOL_NAME };
//# sourceMappingURL=FileWriteTool.d.ts.map