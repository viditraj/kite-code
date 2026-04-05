/**
 * FileReadTool — Read file contents.
 *
 * Implements the same patterns as Claude Code's FileReadTool.ts:
 * - Read files with optional line offset/limit
 * - List directory contents
 * - Always read-only, always concurrency-safe
 * - maxResultSizeChars: Infinity (never persist to disk)
 */
import { z } from 'zod';
declare const FILE_READ_TOOL_NAME = "Read";
export declare const FileReadTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { FILE_READ_TOOL_NAME };
//# sourceMappingURL=FileReadTool.d.ts.map