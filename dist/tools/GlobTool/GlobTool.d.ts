/**
 * GlobTool — Find files by name pattern.
 *
 * Implements the same patterns as Claude Code's GlobTool.ts:
 * - Uses find command with -name flag
 * - Always read-only, always concurrency-safe
 */
import { z } from 'zod';
declare const GLOB_TOOL_NAME = "Glob";
export declare const GlobTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { GLOB_TOOL_NAME };
//# sourceMappingURL=GlobTool.d.ts.map