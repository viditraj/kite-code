/**
 * SandboxManager — Sandbox system for restricting tool execution.
 *
 * Provides bubblewrap (bwrap) integration for sandboxing command execution,
 * path validation against allowed directories, security level management,
 * and sandboxed temp directory creation/cleanup.
 *
 * Configuration:
 * - KITE_SANDBOX=1 environment variable enables sandboxing
 * - KITE_SANDBOX_LEVEL=none|basic|strict sets the security level
 * - Requires `bwrap` (bubblewrap) to be installed for full sandboxing
 */
export declare class SandboxManager {
    /**
     * Check if sandboxing is enabled via environment variable or config.
     *
     * Returns true if KITE_SANDBOX is set to '1' or KITE_SANDBOX_LEVEL is
     * set to 'basic' or 'strict'.
     */
    static isSandboxingEnabled(): boolean;
    /**
     * Check if bubblewrap (bwrap) is available on the system.
     *
     * Uses `which bwrap` to detect installation. Returns false if the
     * command fails or bwrap is not found.
     */
    static isAvailable(): boolean;
    /**
     * Wrap a command with bubblewrap for sandboxed execution.
     *
     * The sandbox provides:
     * - Read-only bind mount of the entire filesystem
     * - Read-write bind mount of the specified working directory
     * - Isolated /dev, /proc, and /tmp
     * - Network isolation (--unshare-net)
     *
     * If bwrap is not available, returns the command unchanged and logs a warning.
     *
     * @param command - The shell command to sandbox
     * @param cwd - The working directory to allow read-write access to
     * @returns The wrapped command string
     */
    static wrapCommand(command: string, cwd: string): string;
    /**
     * Validate that a path is within one of the allowed directories.
     *
     * Performs path normalization and checks that the resolved path starts
     * with one of the allowed base paths. Prevents path traversal attacks.
     *
     * @param path - The path to validate
     * @param allowedPaths - Array of allowed base directory paths
     * @returns true if the path is within an allowed directory
     */
    static validatePath(path: string, allowedPaths: string[]): boolean;
    /**
     * Get the current sandbox security level from configuration.
     *
     * Levels:
     * - 'none': No sandboxing applied
     * - 'basic': Filesystem isolation, no network restriction
     * - 'strict': Full isolation including network restriction
     *
     * Reads from KITE_SANDBOX_LEVEL environment variable, defaulting to 'none'
     * unless KITE_SANDBOX=1 is set (which implies 'basic').
     */
    static getSecurityLevel(): 'none' | 'basic' | 'strict';
    /**
     * Create a sandboxed temporary directory with restricted permissions.
     *
     * The directory is created under the system temp directory with a 'kite-sandbox-'
     * prefix and 0o700 permissions (owner-only read/write/execute).
     *
     * @returns The absolute path to the created temporary directory
     */
    static createTempDir(): string;
    /**
     * Remove a sandboxed temporary directory and all its contents.
     *
     * Uses recursive removal with force flag to ensure cleanup even if
     * the directory contains files. Validates that the path looks like a
     * sandbox temp directory before removing to prevent accidental deletion.
     *
     * @param path - The path to the temporary directory to remove
     */
    static cleanupTempDir(path: string): void;
}
//# sourceMappingURL=SandboxManager.d.ts.map