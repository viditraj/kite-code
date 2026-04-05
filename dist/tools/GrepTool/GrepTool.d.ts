/**
 * GrepTool — Search file contents with regex (ripgrep).
 *
 * Implements the same patterns as Claude Code's GrepTool.ts:
 * - Uses ripgrep (rg) with fallback to grep
 * - Multiple output modes: content, files_with_matches, count
 * - Context lines (-A, -B, -C), case insensitive (-i)
 * - Always read-only, always concurrency-safe
 */
import { z } from 'zod';
declare const GREP_TOOL_NAME = "Grep";
export declare const GrepTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { GREP_TOOL_NAME };
//# sourceMappingURL=GrepTool.d.ts.map