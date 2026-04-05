/**
 * PlanModeTool — Enter and exit plan mode for complex tasks.
 *
 * Provides two tools:
 * - EnterPlanMode: Switch to plan mode to explore and design before coding
 * - ExitPlanMode: Present plan for approval and return to previous mode
 *
 * Plan mode allows the agent to explore the codebase, understand architecture,
 * and design an approach without making changes. The user approves the plan
 * before implementation begins.
 */
import { z } from 'zod';
export declare const ENTER_PLAN_MODE_TOOL_NAME = "EnterPlanMode";
export declare const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
export declare const EnterPlanModeTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const ExitPlanModeTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=PlanModeTool.d.ts.map