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
import { z } from 'zod';
declare const BASH_TOOL_NAME = "Bash";
export declare const BashTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { BASH_TOOL_NAME };
//# sourceMappingURL=BashTool.d.ts.map