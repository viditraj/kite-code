/**
 * SyntheticOutputTool — Format synthetic output for display.
 *
 * Takes content and an optional format, returns the content formatted
 * appropriately for display in the conversation.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const SYNTHETIC_OUTPUT_TOOL_NAME = "SyntheticOutput";
export declare const SyntheticOutputTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { SYNTHETIC_OUTPUT_TOOL_NAME };
//# sourceMappingURL=SyntheticOutputTool.d.ts.map