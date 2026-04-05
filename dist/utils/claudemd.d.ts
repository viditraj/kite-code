/**
 * AGENTS.md / CLAUDE.md loading and parsing.
 *
 * Discovers, loads, and merges memory files (CLAUDE.md, AGENTS.md) from
 * user-level, project-level, and local-level sources. Supports @include
 * directives for composing memory from multiple files, YAML frontmatter,
 * and rules directories (.kite/rules/, .claude/rules/).
 *
 * Loading priority (lowest to highest):
 *   1. User memory: ~/.kite/CLAUDE.md, ~/.kite/AGENTS.md
 *   2. User rules: ~/.kite/rules/*.md
 *   3. Project dirs (root → cwd): CLAUDE.md, AGENTS.md, .kite/, .claude/
 *   4. Local memory: CLAUDE.local.md, AGENTS.local.md per project dir
 */
declare const MEMORY_FILENAMES: string[];
declare const LOCAL_MEMORY_FILENAMES: string[];
declare const RULES_DIR = "rules";
declare const KITE_DIR = ".kite";
declare const CLAUDE_DIR = ".claude";
declare const MAX_INCLUDE_DEPTH = 10;
declare const MAX_FILE_SIZE: number;
export interface MemoryFile {
    path: string;
    content: string;
    source: 'managed' | 'user' | 'project' | 'local';
    type: 'memory' | 'rules';
}
/**
 * Resolve @include directives in memory file content.
 *
 * Supports the following reference patterns:
 *   - `@path`          — relative to basePath (same as @./path)
 *   - `@./relative`    — explicit relative
 *   - `@~/home/path`   — relative to home directory
 *   - `@/absolute/path` — absolute path
 *
 * Directives inside fenced code blocks (``` delimited) or indented code
 * blocks (4+ leading spaces) are left untouched. Circular references are
 * detected via the `seen` set. Recursion is bounded by MAX_INCLUDE_DEPTH.
 * Non-existent files are silently ignored (the @reference is removed).
 *
 * @param content  - Raw file content potentially containing @references
 * @param basePath - Directory to resolve relative paths against
 * @param seen     - Set of already-included absolute paths (cycle prevention)
 * @param depth    - Current recursion depth
 * @returns Content with all @references resolved
 */
export declare function resolveIncludes(content: string, basePath: string, seen?: Set<string>, depth?: number): string;
/**
 * Load a single memory file from disk.
 *
 * Returns null if the file does not exist, cannot be read, or exceeds
 * MAX_FILE_SIZE. Otherwise reads the content, resolves any @include
 * directives, and returns a MemoryFile object.
 *
 * @param filePath - Absolute path to the memory file
 * @param source   - Origin category ('managed', 'user', 'project', 'local')
 * @param type     - Content type ('memory' or 'rules')
 * @returns MemoryFile or null
 */
export declare function loadMemoryFile(filePath: string, source: MemoryFile['source'], type: MemoryFile['type']): MemoryFile | null;
/**
 * Scan a rules directory (.kite/rules/ or .claude/rules/) for .md files.
 *
 * Lists markdown files (non-recursively) in the given directory, loads each
 * as a rules-type MemoryFile, and returns them sorted by filename for
 * deterministic ordering.
 *
 * @param dir    - Absolute path to the rules directory
 * @param source - Origin category for the loaded files
 * @returns Array of MemoryFile objects, sorted by filename
 */
export declare function scanRulesDirectory(dir: string, source: MemoryFile['source']): MemoryFile[];
/**
 * Get directories to scan for project memory files.
 *
 * Walks from the given working directory up to the filesystem root (or the
 * user's home directory), collecting each directory along the way. The
 * returned array is ordered from cwd first (highest priority) to the
 * ancestor nearest the root (lowest priority).
 *
 * @param cwd - Starting directory (typically process.cwd())
 * @returns Array of absolute directory paths, cwd first
 */
export declare function getProjectMemoryDirs(cwd: string): string[];
/**
 * Returns the user-level memory directory (~/.kite/).
 *
 * @returns Absolute path to ~/.kite/
 */
export declare function getUserMemoryDir(): string;
/**
 * Main entry point — load all memory files in priority order.
 *
 * Discovers and loads memory files from all sources:
 *   1. User memory: ~/.kite/CLAUDE.md, ~/.kite/AGENTS.md
 *   2. User rules: ~/.kite/rules/*.md
 *   3. For each project dir (root → cwd):
 *      - CLAUDE.md, AGENTS.md in the directory itself
 *      - .kite/CLAUDE.md, .kite/AGENTS.md
 *      - .claude/CLAUDE.md, .claude/AGENTS.md
 *      - .kite/rules/*.md, .claude/rules/*.md
 *   4. Local memory: CLAUDE.local.md, AGENTS.local.md in each project dir
 *
 * Files are deduplicated by resolved absolute path. The returned array is
 * ordered from lowest to highest priority (user files first, local files last).
 *
 * @param cwd - Current working directory
 * @returns Array of MemoryFile objects
 */
export declare function getMemoryFiles(cwd: string): MemoryFile[];
/**
 * Build the memory section for the system prompt.
 *
 * Groups files by source and formats each file's content with a header
 * showing the source path. Returns a single string suitable for inclusion
 * in a system prompt.
 *
 * @param files - Array of MemoryFile objects to format
 * @returns Formatted string with all memory content
 */
export declare function buildMemoryPromptSection(files: MemoryFile[]): string;
/**
 * Parse optional YAML frontmatter from a memory file.
 *
 * Looks for `---` delimiters at the start of the content, extracts
 * key: value pairs from the block between them, and returns the parsed
 * frontmatter map along with the remaining body text.
 *
 * Reuses the same parsing approach as parseFrontmatter in loadSkillsDir.ts:
 * handles continuation lines (indented), multi-line values, and gracefully
 * falls back to empty frontmatter when no valid block is found.
 *
 * @param content - Raw memory file content
 * @returns Object with `frontmatter` map and `body` string
 */
export declare function parseMemoryFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
};
export { MEMORY_FILENAMES, LOCAL_MEMORY_FILENAMES, RULES_DIR, KITE_DIR, CLAUDE_DIR, MAX_INCLUDE_DEPTH, MAX_FILE_SIZE, };
//# sourceMappingURL=claudemd.d.ts.map