/**
 * Format utilities — relative time, file sizes, and display helpers.
 *
 * Matches Claude Code's utils/format.ts patterns.
 */
export type RelativeTimeStyle = 'narrow' | 'long';
/**
 * Format a date as relative time (e.g., "2h ago", "3 days ago").
 * Uses Intl.RelativeTimeFormat for localization.
 */
export declare function formatRelativeTime(date: Date, options?: {
    style?: RelativeTimeStyle;
    now?: Date;
}): string;
/**
 * Format a date as "X ago" (always past tense).
 */
export declare function formatRelativeTimeAgo(date: Date, options?: {
    style?: RelativeTimeStyle;
    now?: Date;
}): string;
export declare function formatFileSize(bytes: number): string;
export declare function formatTokenCount(n: number): string;
/**
 * Estimate the context window size for a model based on its name.
 * Returns token count.
 */
export declare function getContextWindowForModel(model: string): number;
/**
 * Get the current git branch name. Cached for 10 seconds.
 * Returns null if not in a git repo.
 */
export declare function getGitBranch(): string | null;
//# sourceMappingURL=format.d.ts.map