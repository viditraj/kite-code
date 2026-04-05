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
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { buildTool } from '../../Tool.js';
const ENTER_WORKTREE_TOOL_NAME = 'EnterWorktree';
const EXIT_WORKTREE_TOOL_NAME = 'ExitWorktree';
const EXEC_TIMEOUT_MS = 60_000; // 1 minute
// ============================================================================
// EnterWorktree Tool
// ============================================================================
const enterWorktreeInputSchema = z.strictObject({
    branch: z.string().describe('The branch name to create the worktree for'),
    path: z.string().optional().describe('Optional custom path for the worktree. If not provided, a temp directory is used.'),
});
export const EnterWorktreeTool = buildTool({
    name: ENTER_WORKTREE_TOOL_NAME,
    searchHint: 'create git worktree for parallel branch work',
    maxResultSizeChars: 10_000,
    strict: true,
    inputSchema: enterWorktreeInputSchema,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
    async description({ branch }) {
        return `Create a git worktree for branch "${branch}"`;
    },
    async prompt() {
        return `Create a new git worktree for working on a separate branch in parallel.

This tool runs "git worktree add" to create a new worktree directory linked to the specified branch. The worktree is created in a temporary directory unless a custom path is provided.

Use this when you need to:
- Work on multiple branches simultaneously
- Review or test code from another branch without switching
- Isolate changes to a separate working directory

Input:
- branch: The branch name to create the worktree for
- path: (optional) Custom path for the worktree directory

Use ExitWorktree to clean up the worktree when done.`;
    },
    userFacingName() {
        return ENTER_WORKTREE_TOOL_NAME;
    },
    toAutoClassifierInput(input) {
        return `git worktree add ${input.branch}`;
    },
    getToolUseSummary(input) {
        if (!input?.branch)
            return null;
        return `Creating worktree for "${input.branch}"`;
    },
    getActivityDescription(input) {
        if (!input?.branch)
            return 'Creating git worktree';
        return `Creating git worktree for branch "${input.branch}"`;
    },
    async validateInput(input) {
        if (!input.branch || !input.branch.trim()) {
            return { result: false, message: 'Branch name cannot be empty', errorCode: 1 };
        }
        // Basic branch name validation
        if (/[\s~^:?*\[\]\\]/.test(input.branch)) {
            return { result: false, message: 'Invalid branch name: contains disallowed characters', errorCode: 2 };
        }
        return { result: true };
    },
    async call(input, context) {
        const cwd = context.getCwd();
        const branch = input.branch.trim();
        // Determine worktree path
        let worktreePath;
        if (input.path) {
            worktreePath = input.path;
        }
        else {
            const tempBase = mkdtempSync(join(tmpdir(), 'kite-worktree-'));
            worktreePath = join(tempBase, branch.replace(/\//g, '-'));
        }
        try {
            // Try adding the worktree
            execSync(`git worktree add "${worktreePath}" "${branch}"`, {
                cwd,
                encoding: 'utf-8',
                timeout: EXEC_TIMEOUT_MS,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            // Store the worktree path in appState for ExitWorktree to use
            context.setAppState((prev) => {
                const worktrees = (prev.worktrees ?? {});
                return {
                    ...prev,
                    worktrees: {
                        ...worktrees,
                        [branch]: worktreePath,
                    },
                };
            });
            return {
                data: {
                    worktreePath,
                    branch,
                    message: `Successfully created worktree for branch "${branch}" at ${worktreePath}`,
                },
            };
        }
        catch (err) {
            const e = err;
            const errorMsg = e.stderr || e.message || 'Unknown error creating worktree';
            return {
                data: {
                    worktreePath: '',
                    branch,
                    message: `Failed to create worktree: ${errorMsg}`,
                },
            };
        }
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        const isError = !content.worktreePath;
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.message,
            is_error: isError,
        };
    },
});
// ============================================================================
// ExitWorktree Tool
// ============================================================================
const exitWorktreeInputSchema = z.strictObject({
    branch: z.string().optional().describe('The branch name of the worktree to remove. If not provided, uses the path instead.'),
    path: z.string().optional().describe('The path of the worktree to remove. If not provided, looks up by branch name.'),
    force: z.boolean().optional().describe('Force removal even if worktree has modifications (default: false)'),
});
export const ExitWorktreeTool = buildTool({
    name: EXIT_WORKTREE_TOOL_NAME,
    searchHint: 'remove git worktree cleanup',
    maxResultSizeChars: 10_000,
    strict: true,
    inputSchema: exitWorktreeInputSchema,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
    async description({ branch, path }) {
        const target = branch || path || 'worktree';
        return `Remove git worktree "${target}"`;
    },
    async prompt() {
        return `Remove a git worktree that was previously created with EnterWorktree.

This tool runs "git worktree remove" to clean up a worktree directory.

Input:
- branch: (optional) The branch name used when creating the worktree
- path: (optional) The filesystem path of the worktree
- force: (optional) Force removal even with modifications (default: false)

At least one of "branch" or "path" must be provided.`;
    },
    userFacingName() {
        return EXIT_WORKTREE_TOOL_NAME;
    },
    toAutoClassifierInput(input) {
        return `git worktree remove ${input.branch || input.path || ''}`;
    },
    getToolUseSummary(input) {
        const target = input?.branch || input?.path;
        if (!target)
            return null;
        return `Removing worktree "${target}"`;
    },
    getActivityDescription(input) {
        const target = input?.branch || input?.path;
        if (!target)
            return 'Removing git worktree';
        return `Removing git worktree "${target}"`;
    },
    async validateInput(input) {
        if (!input.branch && !input.path) {
            return { result: false, message: 'At least one of "branch" or "path" must be provided', errorCode: 1 };
        }
        return { result: true };
    },
    async call(input, context) {
        const cwd = context.getCwd();
        const force = input.force ?? false;
        // Determine the worktree path
        let worktreePath = input.path;
        if (!worktreePath && input.branch) {
            const appState = context.getAppState();
            const worktrees = (appState.worktrees ?? {});
            worktreePath = worktrees[input.branch];
        }
        if (!worktreePath) {
            return {
                data: {
                    message: `Could not find worktree for branch "${input.branch}". Provide the "path" directly or ensure the worktree was created with EnterWorktree.`,
                    removed: false,
                },
            };
        }
        try {
            const forceFlag = force ? ' --force' : '';
            execSync(`git worktree remove "${worktreePath}"${forceFlag}`, {
                cwd,
                encoding: 'utf-8',
                timeout: EXEC_TIMEOUT_MS,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            // Remove from appState
            if (input.branch) {
                context.setAppState((prev) => {
                    const worktrees = { ...(prev.worktrees ?? {}) };
                    delete worktrees[input.branch];
                    return { ...prev, worktrees };
                });
            }
            return {
                data: {
                    message: `Successfully removed worktree at ${worktreePath}`,
                    removed: true,
                },
            };
        }
        catch (err) {
            const e = err;
            const errorMsg = e.stderr || e.message || 'Unknown error removing worktree';
            return {
                data: {
                    message: `Failed to remove worktree: ${errorMsg}`,
                    removed: false,
                },
            };
        }
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.message,
            is_error: !content.removed,
        };
    },
});
export { ENTER_WORKTREE_TOOL_NAME, EXIT_WORKTREE_TOOL_NAME };
//# sourceMappingURL=WorktreeTool.js.map