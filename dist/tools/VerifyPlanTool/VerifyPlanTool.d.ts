/**
 * VerifyPlanTool — Verify that plan steps have been executed.
 *
 * Checks plan steps against the conversation history and appState
 * to determine which steps are completed, in progress, or pending.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const VERIFY_PLAN_TOOL_NAME = "VerifyPlan";
export declare const VerifyPlanTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { VERIFY_PLAN_TOOL_NAME };
//# sourceMappingURL=VerifyPlanTool.d.ts.map