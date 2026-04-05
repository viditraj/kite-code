/**
 * AskUserQuestionTool — Present multiple-choice questions to the user.
 *
 * Implements the same patterns as Claude Code's AskUserQuestionTool:
 * - Present 1-4 multiple-choice questions
 * - Each question has 2-4 options plus auto-added "Other"
 * - Supports single-select and multi-select
 * - Collects answers keyed by question text
 * - Always read-only, concurrency-safe, requires user interaction
 */
import { z } from 'zod';
export declare const ASK_USER_QUESTION_TOOL_NAME = "AskUserQuestion";
export declare const ASK_USER_QUESTION_TOOL_CHIP_WIDTH = 12;
export declare const AskUserQuestionTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=AskUserQuestionTool.d.ts.map