/**
 * Walk up from startPath (or cwd) looking for a .git directory or .git file (worktree).
 * Returns the directory containing .git, or null if not found.
 */
export declare function findGitRoot(startPath?: string): string | null;
/**
 * Find the canonical git root (for worktrees, this is the main repo).
 * If .git is a file (worktree), follows the gitdir pointer to find
 * the actual .git directory and returns the canonical root.
 */
export declare function findCanonicalGitRoot(startPath?: string): string | null;
/**
 * Resolve a git ref (e.g. "refs/heads/main") to a full SHA.
 * Checks loose refs first, then falls back to packed-refs.
 */
export declare function resolveRef(gitDir: string, ref: string): string | null;
/**
 * Get the current git branch name.
 * Returns abbreviated SHA (first 8 chars) if in detached HEAD state.
 * Returns null if not in a git repo.
 */
export declare function getGitBranch(cwd?: string): string | null;
/**
 * Get the current commit SHA (full 40-char hex string).
 * Resolves symbolic refs through to the actual commit SHA.
 * Returns null if not in a git repo.
 */
export declare function getGitSHA(cwd?: string): string | null;
/**
 * Run `git status --short` and return the trimmed output.
 * Returns empty string on error.
 */
export declare function getGitStatus(cwd?: string): string;
/**
 * Run `git diff` (or `git diff --staged`) and return the trimmed output.
 * Returns empty string on error.
 */
export declare function getGitDiff(cwd?: string, staged?: boolean): string;
/**
 * Run `git log --oneline -N` and return the trimmed output.
 * Default count is 10.
 * Returns empty string on error.
 */
export declare function getGitLog(cwd?: string, count?: number): string;
/**
 * Check if the given directory is inside a git repository.
 */
export declare function isGitRepo(cwd?: string): boolean;
/**
 * Check if the repository is a shallow clone by looking for `.git/shallow`.
 */
export declare function isShallowRepo(cwd?: string): boolean;
/**
 * Get the remote URL for "origin".
 * Returns null on error or if no origin remote exists.
 */
export declare function getGitRemoteUrl(cwd?: string): string | null;
/**
 * Get list of modified (unstaged) files.
 * Returns an array of file paths.
 */
export declare function getModifiedFiles(cwd?: string): string[];
/**
 * Get list of staged files.
 * Returns an array of file paths.
 */
export declare function getStagedFiles(cwd?: string): string[];
/**
 * Check if a path is gitignored.
 * Returns true if the path is ignored by git, false otherwise.
 */
export declare function isPathGitignored(filePath: string, cwd?: string): boolean;
/**
 * Represents the state of the git HEAD pointer.
 */
export interface GitHeadState {
    branch: string | null;
    sha: string | null;
    isDetached: boolean;
    isDirty: boolean;
}
/**
 * Get the combined HEAD state including branch, SHA, detached status, and dirty status.
 */
export declare function getGitHeadState(cwd?: string): GitHeadState;
//# sourceMappingURL=index.d.ts.map