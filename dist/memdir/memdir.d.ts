/**
 * Memory system for session and project memory.
 *
 * Provides reading/writing of MEMORY.md files, daily logs,
 * memory prompt construction, and scanning for project memory
 * files (AGENTS.md, CLAUDE.md, MEMORY.md) across the directory hierarchy.
 */
export declare const ENTRYPOINT_NAME = "MEMORY.md";
export declare const MAX_ENTRYPOINT_LINES = 200;
export declare const MAX_ENTRYPOINT_BYTES = 25000;
export interface EntrypointTruncation {
    content: string;
    lineCount: number;
    byteCount: number;
    wasLineTruncated: boolean;
    wasByteTruncated: boolean;
}
export declare const MEMORY_TYPES_SECTION = "## Types of Memories to Save\n- User preferences and workflow patterns\n- Project architecture and key design decisions\n- Important file locations and their purposes\n- Common commands and build processes\n- Code conventions and naming patterns\n- Known issues and their workarounds";
export declare const WHEN_TO_ACCESS_SECTION = "## When to Access Memories\n- At the start of a new conversation\n- When working on a task related to stored knowledge\n- When the user asks about project structure or conventions";
export declare const WHAT_NOT_TO_SAVE_SECTION = "## What NOT to Save\n- Temporary or one-time information\n- Sensitive data (API keys, passwords, tokens)\n- Information that changes frequently\n- Exact code snippets (save descriptions/locations instead)";
/**
 * Truncate MEMORY.md content to line AND byte caps.
 *
 * - Trims input, splits by newlines
 * - If lines exceed MAX_ENTRYPOINT_LINES, truncate to that many lines
 * - If byte size exceeds MAX_ENTRYPOINT_BYTES, truncate at the last newline
 *   before the cap
 * - Appends a warning footer indicating the reason (line count, byte size,
 *   or both)
 * - Returns the (possibly truncated) content plus metadata
 */
export declare function truncateEntrypointContent(raw: string): EntrypointTruncation;
/**
 * Read MEMORY.md from the auto-memory directory.
 *
 * Returns the file contents as a string, or null if auto-memory is disabled
 * or the file does not exist.
 */
export declare function readMemoryFile(projectRoot?: string): string | null;
/**
 * Write content to MEMORY.md in the auto-memory directory.
 *
 * Creates the directory tree as needed.
 */
export declare function writeMemoryFile(content: string, projectRoot?: string): void;
/**
 * Append content to the existing MEMORY.md, creating the file if it does
 * not yet exist.
 */
export declare function appendToMemoryFile(content: string, projectRoot?: string): void;
/**
 * Append content to the daily log file (YYYY-MM-DD.md).
 *
 * Creates directories as needed. Uses today's date when none is provided.
 */
export declare function appendToDailyLog(content: string, date?: Date): void;
/**
 * Read the daily log for the given date.
 *
 * Returns the file contents, or null if the log does not exist.
 * Uses today's date when none is provided.
 */
export declare function readDailyLog(date?: Date): string | null;
/**
 * Build the memory section for the system prompt.
 *
 * - Reads MEMORY.md from the auto-memory directory
 * - Truncates if the file exceeds line or byte caps
 * - Wraps the content in instructional context about the memory format
 * - Includes guidance on when and what to save
 * - Returns a formatted prompt section, or an empty string if auto-memory
 *   is disabled or no memories exist
 */
export declare function buildMemoryPrompt(projectRoot?: string): string;
/**
 * Scan for all memory files (AGENTS.md, CLAUDE.md, MEMORY.md) in the
 * project hierarchy.
 *
 * The scan works as follows:
 * 1. Walk from `cwd` up to the user's home directory, checking each
 *    directory for AGENTS.md and CLAUDE.md.
 * 2. Check `~/.kite/` for a global AGENTS.md.
 * 3. Include MEMORY.md from the auto-memory directory (if it exists and
 *    auto-memory is enabled).
 *
 * Returns an array of objects with `path`, `content`, and `source` fields.
 * The `source` field indicates where the file was found (e.g. "project",
 * "ancestor", "global", "auto-memory").
 */
export declare function getMemoryFiles(cwd: string): Array<{
    path: string;
    content: string;
    source: string;
}>;
//# sourceMappingURL=memdir.d.ts.map