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
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, normalize } from 'path';
export class SandboxManager {
    /**
     * Check if sandboxing is enabled via environment variable or config.
     *
     * Returns true if KITE_SANDBOX is set to '1' or KITE_SANDBOX_LEVEL is
     * set to 'basic' or 'strict'.
     */
    static isSandboxingEnabled() {
        if (process.env.KITE_SANDBOX === '1') {
            return true;
        }
        const level = process.env.KITE_SANDBOX_LEVEL;
        if (level === 'basic' || level === 'strict') {
            return true;
        }
        return false;
    }
    /**
     * Check if bubblewrap (bwrap) is available on the system.
     *
     * Uses `which bwrap` to detect installation. Returns false if the
     * command fails or bwrap is not found.
     */
    static isAvailable() {
        try {
            execSync('which bwrap', {
                encoding: 'utf-8',
                timeout: 5_000,
                stdio: 'pipe',
            });
            return true;
        }
        catch {
            return false;
        }
    }
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
    static wrapCommand(command, cwd) {
        if (!SandboxManager.isAvailable()) {
            console.warn('[SandboxManager] bwrap is not available. Running command without sandboxing.');
            return command;
        }
        const resolvedCwd = resolve(cwd);
        // Escape single quotes in the command for safe shell embedding
        const escapedCommand = command.replace(/'/g, "'\\''");
        return [
            'bwrap',
            '--ro-bind / /',
            `--bind ${resolvedCwd} ${resolvedCwd}`,
            '--dev /dev',
            '--proc /proc',
            '--tmpfs /tmp',
            '--unshare-net',
            '--',
            '/bin/bash',
            `-c '${escapedCommand}'`,
        ].join(' ');
    }
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
    static validatePath(path, allowedPaths) {
        const normalizedPath = normalize(resolve(path));
        for (const allowed of allowedPaths) {
            const normalizedAllowed = normalize(resolve(allowed));
            // Check exact match or that the path is a child of the allowed directory
            if (normalizedPath === normalizedAllowed ||
                normalizedPath.startsWith(normalizedAllowed + '/')) {
                return true;
            }
        }
        return false;
    }
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
    static getSecurityLevel() {
        const level = process.env.KITE_SANDBOX_LEVEL;
        if (level === 'strict')
            return 'strict';
        if (level === 'basic')
            return 'basic';
        // If KITE_SANDBOX=1 but no level is set, default to 'basic'
        if (process.env.KITE_SANDBOX === '1')
            return 'basic';
        return 'none';
    }
    /**
     * Create a sandboxed temporary directory with restricted permissions.
     *
     * The directory is created under the system temp directory with a 'kite-sandbox-'
     * prefix and 0o700 permissions (owner-only read/write/execute).
     *
     * @returns The absolute path to the created temporary directory
     */
    static createTempDir() {
        const prefix = join(tmpdir(), 'kite-sandbox-');
        const tempDir = mkdtempSync(prefix);
        // Set restrictive permissions (owner-only)
        try {
            execSync(`chmod 700 ${tempDir}`, {
                encoding: 'utf-8',
                timeout: 5_000,
                stdio: 'pipe',
            });
        }
        catch {
            // chmod may fail on some systems (e.g., Windows); directory is still created
        }
        return tempDir;
    }
    /**
     * Remove a sandboxed temporary directory and all its contents.
     *
     * Uses recursive removal with force flag to ensure cleanup even if
     * the directory contains files. Validates that the path looks like a
     * sandbox temp directory before removing to prevent accidental deletion.
     *
     * @param path - The path to the temporary directory to remove
     */
    static cleanupTempDir(path) {
        const normalizedPath = normalize(resolve(path));
        const tempBase = normalize(tmpdir());
        // Safety check: only remove directories that are under the system temp directory
        // and match the sandbox naming convention
        if (!normalizedPath.startsWith(tempBase + '/')) {
            throw new Error(`[SandboxManager] Refusing to remove directory outside of temp: ${path}`);
        }
        if (!normalizedPath.includes('kite-sandbox-')) {
            throw new Error(`[SandboxManager] Refusing to remove non-sandbox directory: ${path}`);
        }
        rmSync(normalizedPath, { recursive: true, force: true });
    }
}
//# sourceMappingURL=SandboxManager.js.map