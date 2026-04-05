/**
 * Filesystem path safety checks for the permission system.
 *
 * Implements the same safety logic as Claude Code's filesystem.ts:
 * - Dangerous file/directory detection
 * - Windows path pattern detection (defense-in-depth)
 * - Path containment checks (pathInWorkingPath)
 * - Case-insensitive comparison
 * - Symlink normalization for macOS (/private/tmp → /tmp)
 * - Path safety for auto-edit mode
 *
 * Adapted for Kite: no bun:bundle, no Statsig gates, no session-storage dependencies.
 */
/**
 * Files that should be protected from auto-editing without explicit permission.
 * These files can be used for code execution or data exfiltration.
 */
export declare const DANGEROUS_FILES: readonly [".gitconfig", ".gitmodules", ".bashrc", ".bash_profile", ".zshrc", ".zprofile", ".profile", ".ripgreprc", ".mcp.json", ".kite.json"];
/**
 * Directories that should be protected from auto-editing.
 * These directories contain sensitive configuration or executable files.
 */
export declare const DANGEROUS_DIRECTORIES: readonly [".git", ".vscode", ".idea", ".kite"];
/**
 * Normalize a path for case-insensitive comparison.
 * Prevents bypasses on case-insensitive filesystems (macOS/Windows).
 */
export declare function normalizeCaseForComparison(path: string): string;
/**
 * Check if a file path is dangerous to auto-edit without explicit permission.
 */
export declare function isDangerousFilePathToAutoEdit(path: string): boolean;
/**
 * Detect suspicious Windows path patterns that could bypass security checks.
 *
 * Checks: NTFS ADS, 8.3 short names, long path prefixes,
 * trailing dots/spaces, DOS device names, triple dots, UNC paths.
 */
export declare function hasSuspiciousWindowsPathPattern(path: string): boolean;
/**
 * Check if a path is within a working directory.
 * Handles macOS /private/tmp symlink normalization and case-insensitive comparison.
 */
export declare function pathInWorkingPath(path: string, workingPath: string): boolean;
/**
 * Check if a path is within ANY of the allowed working directories.
 */
export declare function pathInAllowedWorkingPaths(path: string, workingDirectories: string[]): boolean;
export type PathSafetyResult = {
    safe: true;
} | {
    safe: false;
    message: string;
    classifierApprovable: boolean;
};
/**
 * Comprehensive safety validation for auto-editing a path.
 *
 * Checks (in order):
 *   1. Suspicious Windows path patterns
 *   2. Kite config files (.kite/settings.json, etc.)
 *   3. Dangerous files/directories
 *
 * When symlink-resolved paths are available, pass them as pathsToCheck
 * so BOTH original and resolved paths are validated.
 */
export declare function checkPathSafetyForAutoEdit(path: string, pathsToCheck?: readonly string[]): PathSafetyResult;
/**
 * Check if a path is a Kite settings file.
 */
export declare function isKiteSettingsPath(filePath: string): boolean;
/**
 * Check if a path is any Kite config file (settings, commands, agents, skills).
 */
export declare function isKiteConfigFilePath(filePath: string): boolean;
/**
 * Returns the user-specific Kite temp directory name.
 * On Unix: 'kite-{uid}' (per-user isolation)
 * On Windows: 'kite' (tmpdir is already per-user)
 */
export declare function getKiteTempDirName(): string;
/**
 * Returns the Kite temp directory with symlinks resolved.
 * Memoized for the process lifetime.
 */
export declare function getKiteTempDir(): string;
/**
 * Reset the memoized temp dir (for testing).
 */
export declare function _resetKiteTempDir(): void;
//# sourceMappingURL=filesystem.d.ts.map