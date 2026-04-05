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
import { normalize, posix, sep, join } from 'path';
import { realpathSync } from 'fs';
import { tmpdir } from 'os';
// ============================================================================
// Dangerous file lists
// ============================================================================
/**
 * Files that should be protected from auto-editing without explicit permission.
 * These files can be used for code execution or data exfiltration.
 */
export const DANGEROUS_FILES = [
    '.gitconfig',
    '.gitmodules',
    '.bashrc',
    '.bash_profile',
    '.zshrc',
    '.zprofile',
    '.profile',
    '.ripgreprc',
    '.mcp.json',
    '.kite.json',
];
/**
 * Directories that should be protected from auto-editing.
 * These directories contain sensitive configuration or executable files.
 */
export const DANGEROUS_DIRECTORIES = [
    '.git',
    '.vscode',
    '.idea',
    '.kite',
];
// ============================================================================
// Case normalization
// ============================================================================
/**
 * Normalize a path for case-insensitive comparison.
 * Prevents bypasses on case-insensitive filesystems (macOS/Windows).
 */
export function normalizeCaseForComparison(path) {
    return path.toLowerCase();
}
// ============================================================================
// Path expansion
// ============================================================================
/**
 * Expand ~ and normalize path.
 * Basic version; Claude Code's expandPath is more elaborate.
 */
function expandPath(p) {
    if (p.startsWith('~/') || p === '~') {
        const home = process.env.HOME || process.env.USERPROFILE || '/';
        return normalize(p.replace(/^~/, home));
    }
    return normalize(p);
}
/**
 * Check if a relative path contains traversal (.. segments).
 */
function containsPathTraversal(relative) {
    const segments = relative.split('/');
    return segments.some(s => s === '..');
}
// ============================================================================
// Dangerous file detection
// ============================================================================
/**
 * Check if a file path is dangerous to auto-edit without explicit permission.
 */
export function isDangerousFilePathToAutoEdit(path) {
    const absolutePath = expandPath(path);
    const pathSegments = absolutePath.split(sep);
    const fileName = pathSegments.at(-1);
    // UNC paths
    if (path.startsWith('\\\\') || path.startsWith('//')) {
        return true;
    }
    // Check dangerous directories (case-insensitive)
    for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        const normalizedSegment = normalizeCaseForComparison(segment);
        for (const dir of DANGEROUS_DIRECTORIES) {
            if (normalizedSegment !== normalizeCaseForComparison(dir))
                continue;
            // Special case: .kite/worktrees/ is structural, not dangerous
            if (dir === '.kite') {
                const nextSegment = pathSegments[i + 1];
                if (nextSegment && normalizeCaseForComparison(nextSegment) === 'worktrees') {
                    break;
                }
            }
            return true;
        }
    }
    // Check dangerous files (case-insensitive)
    if (fileName) {
        const normalizedFileName = normalizeCaseForComparison(fileName);
        if (DANGEROUS_FILES.some(f => normalizeCaseForComparison(f) === normalizedFileName)) {
            return true;
        }
    }
    return false;
}
// ============================================================================
// Windows path pattern detection
// ============================================================================
/**
 * Detect suspicious Windows path patterns that could bypass security checks.
 *
 * Checks: NTFS ADS, 8.3 short names, long path prefixes,
 * trailing dots/spaces, DOS device names, triple dots, UNC paths.
 */
export function hasSuspiciousWindowsPathPattern(path) {
    // NTFS Alternate Data Streams (Windows/WSL only)
    if (process.platform === 'win32') {
        const colonIndex = path.indexOf(':', 2);
        if (colonIndex !== -1)
            return true;
    }
    // 8.3 short names: ~digit
    if (/~\d/.test(path))
        return true;
    // Long path prefixes
    if (path.startsWith('\\\\?\\') ||
        path.startsWith('\\\\.\\') ||
        path.startsWith('//?/') ||
        path.startsWith('//./')) {
        return true;
    }
    // Trailing dots and spaces
    if (/[.\s]+$/.test(path))
        return true;
    // DOS device names
    if (/\.(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(path))
        return true;
    // Triple+ consecutive dots as path component
    if (/(^|\/|\\)\.{3,}(\/|\\|$)/.test(path))
        return true;
    // UNC paths
    if (path.startsWith('\\\\') || path.startsWith('//'))
        return true;
    return false;
}
// ============================================================================
// Path containment
// ============================================================================
/**
 * Check if a path is within a working directory.
 * Handles macOS /private/tmp symlink normalization and case-insensitive comparison.
 */
export function pathInWorkingPath(path, workingPath) {
    const absolutePath = expandPath(path);
    const absoluteWorkingPath = expandPath(workingPath);
    // macOS symlink normalization
    const normalizedPath = absolutePath
        .replace(/^\/private\/var\//, '/var/')
        .replace(/^\/private\/tmp(\/|$)/, '/tmp$1');
    const normalizedWorkingPath = absoluteWorkingPath
        .replace(/^\/private\/var\//, '/var/')
        .replace(/^\/private\/tmp(\/|$)/, '/tmp$1');
    const caseNormalizedPath = normalizeCaseForComparison(normalizedPath);
    const caseNormalizedWorkingPath = normalizeCaseForComparison(normalizedWorkingPath);
    const relative = posix.relative(caseNormalizedWorkingPath, caseNormalizedPath);
    // Same path
    if (relative === '')
        return true;
    // Contains traversal
    if (containsPathTraversal(relative))
        return false;
    // Inside working dir (relative, no absolute prefix)
    return !posix.isAbsolute(relative);
}
/**
 * Check if a path is within ANY of the allowed working directories.
 */
export function pathInAllowedWorkingPaths(path, workingDirectories) {
    return workingDirectories.some(wd => pathInWorkingPath(path, wd));
}
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
export function checkPathSafetyForAutoEdit(path, pathsToCheck) {
    const paths = pathsToCheck ?? [path];
    // 1. Suspicious Windows path patterns
    for (const p of paths) {
        if (hasSuspiciousWindowsPathPattern(p)) {
            return {
                safe: false,
                message: `Kite requested permissions to write to ${path}, which contains a suspicious Windows path pattern that requires manual approval.`,
                classifierApprovable: false,
            };
        }
    }
    // 2. Kite config files
    for (const p of paths) {
        if (isKiteConfigFilePath(p)) {
            return {
                safe: false,
                message: `Kite requested permissions to write to ${path}, but you haven't granted it yet.`,
                classifierApprovable: true,
            };
        }
    }
    // 3. Dangerous files
    for (const p of paths) {
        if (isDangerousFilePathToAutoEdit(p)) {
            return {
                safe: false,
                message: `Kite requested permissions to edit ${path} which is a sensitive file.`,
                classifierApprovable: true,
            };
        }
    }
    return { safe: true };
}
// ============================================================================
// Kite config file detection
// ============================================================================
/**
 * Check if a path is a Kite settings file.
 */
export function isKiteSettingsPath(filePath) {
    const expanded = expandPath(filePath);
    const normalized = normalizeCaseForComparison(expanded);
    return (normalized.endsWith(`${sep}.kite${sep}settings.json`) ||
        normalized.endsWith(`${sep}.kite${sep}settings.local.json`));
}
/**
 * Check if a path is any Kite config file (settings, commands, agents, skills).
 */
export function isKiteConfigFilePath(filePath) {
    if (isKiteSettingsPath(filePath))
        return true;
    const expanded = expandPath(filePath);
    const normalized = normalizeCaseForComparison(expanded);
    // Check for .kite/commands/, .kite/agents/, .kite/skills/ anywhere in path
    const configDirs = [
        `${sep}.kite${sep}commands${sep}`,
        `${sep}.kite${sep}agents${sep}`,
        `${sep}.kite${sep}skills${sep}`,
    ];
    return configDirs.some(d => normalized.includes(normalizeCaseForComparison(d)));
}
// ============================================================================
// Temp directory helpers
// ============================================================================
/**
 * Returns the user-specific Kite temp directory name.
 * On Unix: 'kite-{uid}' (per-user isolation)
 * On Windows: 'kite' (tmpdir is already per-user)
 */
export function getKiteTempDirName() {
    if (process.platform === 'win32')
        return 'kite';
    const uid = process.getuid?.() ?? 0;
    return `kite-${uid}`;
}
let _kiteTempDir = null;
/**
 * Returns the Kite temp directory with symlinks resolved.
 * Memoized for the process lifetime.
 */
export function getKiteTempDir() {
    if (_kiteTempDir)
        return _kiteTempDir;
    const baseTmpDir = process.env.KITE_TMPDIR || (process.platform === 'win32' ? tmpdir() : '/tmp');
    let resolved = baseTmpDir;
    try {
        resolved = realpathSync(baseTmpDir);
    }
    catch {
        // fallback to original
    }
    _kiteTempDir = join(resolved, getKiteTempDirName()) + sep;
    return _kiteTempDir;
}
/**
 * Reset the memoized temp dir (for testing).
 */
export function _resetKiteTempDir() {
    _kiteTempDir = null;
}
//# sourceMappingURL=filesystem.js.map