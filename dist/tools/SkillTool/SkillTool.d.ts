/**
 * SkillTool — Execute a custom skill from .kite/skills/.
 *
 * Looks for a skill definition in .kite/skills/{skill_name}/SKILL.md,
 * reads the file, and returns its content as context for the agent.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const SKILL_TOOL_NAME = "Skill";
export declare const SkillTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { SKILL_TOOL_NAME };
//# sourceMappingURL=SkillTool.d.ts.map