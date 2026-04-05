/**
 * WorktreeTool — Manage git worktrees.
 *
 * Provides two tools:
 * - EnterWorktreeTool: Create a git worktree for a given branch in a temp directory
 * - ExitWorktreeTool: Remove a git worktree
 *
 * Uses child_process.execSync for git operations.
 * Passthrough permissions (defers to the general permission system).
 */
import { z } from 'zod';
declare const ENTER_WORKTREE_TOOL_NAME = "EnterWorktree";
declare const EXIT_WORKTREE_TOOL_NAME = "ExitWorktree";
export declare const EnterWorktreeTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const ExitWorktreeTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { ENTER_WORKTREE_TOOL_NAME, EXIT_WORKTREE_TOOL_NAME };
//# sourceMappingURL=WorktreeTool.d.ts.map