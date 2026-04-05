/**
 * PowerShellTool — Execute PowerShell commands on Windows.
 *
 * Uses child_process.execSync with powershell.exe -Command prefix.
 * On non-Windows platforms, returns an error message.
 * Includes timeout, output truncation, and permission matching.
 */
import { z } from 'zod';
declare const POWERSHELL_TOOL_NAME = "PowerShell";
export declare const PowerShellTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { POWERSHELL_TOOL_NAME };
//# sourceMappingURL=PowerShellTool.d.ts.map