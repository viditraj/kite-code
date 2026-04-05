/**
 * SleepTool — Delay execution for a given number of milliseconds.
 *
 * Simple async delay tool with a maximum duration of 5 minutes.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const SLEEP_TOOL_NAME = "Sleep";
export declare const SleepTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { SLEEP_TOOL_NAME };
//# sourceMappingURL=SleepTool.d.ts.map