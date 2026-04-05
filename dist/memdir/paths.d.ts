declare const AUTO_MEM_DIRNAME = "memory";
declare const AUTO_MEM_ENTRYPOINT_NAME = "MEMORY.md";
declare const KITE_CONFIG_DIR = ".kite";
/**
 * Whether auto-memory features are enabled (memdir, agent memory, past
 * session search). Enabled by default.
 *
 * Priority chain (first defined wins):
 *   1. KITE_DISABLE_AUTO_MEMORY env var (1/true → OFF)
 *   2. KITE_SIMPLE (--bare mode) → OFF
 *   3. Default: enabled
 */
export declare function isAutoMemoryEnabled(): boolean;
/**
 * Returns the base directory for persistent memory storage.
 *
 * Resolution order:
 *   1. KITE_MEMORY_DIR env var if set
 *   2. ~/.kite/
 */
export declare function getMemoryBaseDir(): string;
/**
 * Normalize and validate a candidate memory directory path.
 *
 * SECURITY: Rejects paths that would be dangerous as a read-allowlist root
 * or that normalize() doesn't fully resolve:
 * - relative (!isAbsolute): "../foo" — would be interpreted relative to CWD
 * - root/near-root (length < 3): "/" → "" after strip; "/a" too short
 * - UNC paths (\\server\share or //server/share): opaque trust boundary
 * - null byte: survives normalize(), can truncate in syscalls
 *
 * When `expandTilde` is true, paths starting with ~/ are expanded to
 * $HOME + rest. Bare "~", "~/", "~/.", "~/.." are rejected because they
 * would expand to $HOME or its parent.
 *
 * Returns the normalized path with exactly one trailing separator,
 * or undefined if the path is unset/empty/rejected.
 */
export declare function validateMemoryPath(raw: string | undefined, expandTilde: boolean): string | undefined;
/**
 * Sanitize a path for use as a directory name.
 *
 * - Replaces path separators (/ and \) with underscores
 * - Replaces colons with underscores
 * - Removes leading dots (prevents hidden directories)
 * - Trims to 200 chars max; when truncated, appends a hash suffix for
 *   uniqueness so two long paths that share a 200-char prefix don't collide.
 */
export declare function sanitizePath(p: string): string;
/**
 * Returns the auto-memory directory path.
 *
 * Resolution order:
 *   1. KITE_MEMORY_PATH_OVERRIDE env var (full-path override)
 *   2. autoMemoryDirectory in ~/.kite/settings.json (trusted source only)
 *   3. {memoryBase}/projects/{sanitized-cwd}/memory/
 *      where memoryBase is resolved by getMemoryBaseDir()
 *
 * Memoized by projectRoot to avoid redundant filesystem/env reads on
 * hot paths (render loops, permission checks, etc.).
 */
export declare function getAutoMemPath(projectRoot?: string): string;
/**
 * Returns the auto-memory entrypoint (MEMORY.md inside the auto-memory dir).
 * Follows the same resolution order as getAutoMemPath().
 */
export declare function getAutoMemEntrypoint(projectRoot?: string): string;
/**
 * Returns the daily log file path for the given date (defaults to today).
 * Shape: {autoMemPath}/logs/YYYY/MM/YYYY-MM-DD.md
 */
export declare function getAutoMemDailyLogPath(date?: Date): string;
/**
 * Check if an absolute path is within the auto-memory directory.
 * Normalizes both paths before comparison to prevent traversal bypasses
 * via .. segments or redundant separators.
 */
export declare function isAutoMemPath(absolutePath: string): boolean;
/**
 * Returns true if KITE_MEMORY_PATH_OVERRIDE env var is set to a valid path.
 * Use this as a signal that the caller has explicitly opted into
 * the auto-memory mechanics.
 */
export declare function hasAutoMemPathOverride(): boolean;
/**
 * Clear the memoization cache for getAutoMemPath. Exposed for tests that
 * change env vars or settings between assertions.
 */
export declare function _clearAutoMemPathCache(): void;
export { AUTO_MEM_DIRNAME, AUTO_MEM_ENTRYPOINT_NAME, KITE_CONFIG_DIR };
//# sourceMappingURL=paths.d.ts.map