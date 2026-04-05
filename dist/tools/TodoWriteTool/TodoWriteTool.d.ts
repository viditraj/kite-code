/**
 * TodoWriteTool — Manage the session task checklist.
 *
 * Matches Claude Code's TodoWriteTool pattern:
 * - Items have content, status, and id
 * - Stores state in appState.todos keyed by agentId
 * - Clears list when all items are completed
 * - Auto-allowed (no permission prompt)
 * - Resilient input handling: normalizes malformed LLM inputs
 */
import { z } from 'zod';
export declare const TODO_WRITE_TOOL_NAME = "TodoWrite";
export declare const TodoWriteTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=TodoWriteTool.d.ts.map