import { homedir } from 'os'
import { join, normalize, isAbsolute, sep } from 'path'
import { existsSync, readFileSync } from 'fs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_MEM_DIRNAME = 'memory'
const AUTO_MEM_ENTRYPOINT_NAME = 'MEMORY.md'
const KITE_CONFIG_DIR = '.kite'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether an env var string represents a truthy value.
 * Matches: '1', 'true', 'yes', 'on' (case-insensitive, trimmed).
 */
function isEnvTruthy(envVar: string | undefined): boolean {
  if (!envVar) return false
  const v = envVar.toLowerCase().trim()
  return ['1', 'true', 'yes', 'on'].includes(v)
}

/**
 * djb2 string hash — fast non-cryptographic hash returning a signed 32-bit int.
 * Deterministic across runtimes.
 */
function djb2Hash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * Maximum length for a single sanitized path component.
 * Most filesystems limit individual components to 255 bytes.
 * We use 200 to leave room for a hash suffix and separator.
 */
const MAX_SANITIZED_LENGTH = 200

/**
 * Read the `autoMemoryDirectory` field from the user-level settings file
 * (~/.kite/settings.json). Project-level settings (.kite/settings.json in
 * the repo) are intentionally excluded for security — a malicious repo
 * could otherwise redirect memory to sensitive directories.
 *
 * Returns undefined if the file doesn't exist or the field is absent.
 */
function readAutoMemoryDirectoryFromSettings(): string | undefined {
  try {
    const settingsPath = join(homedir(), KITE_CONFIG_DIR, 'settings.json')
    if (!existsSync(settingsPath)) return undefined
    const data = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<
      string,
      unknown
    >
    if (typeof data.autoMemoryDirectory === 'string') {
      return data.autoMemoryDirectory
    }
    return undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Memoization cache for getAutoMemPath
// ---------------------------------------------------------------------------

const _autoMemPathCache = new Map<string, string>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether auto-memory features are enabled (memdir, agent memory, past
 * session search). Enabled by default.
 *
 * Priority chain (first defined wins):
 *   1. KITE_DISABLE_AUTO_MEMORY env var (1/true → OFF)
 *   2. KITE_SIMPLE (--bare mode) → OFF
 *   3. Default: enabled
 */
export function isAutoMemoryEnabled(): boolean {
  const envVal = process.env.KITE_DISABLE_AUTO_MEMORY
  if (isEnvTruthy(envVal)) {
    return false
  }
  if (isEnvTruthy(process.env.KITE_SIMPLE)) {
    return false
  }
  return true
}

/**
 * Returns the base directory for persistent memory storage.
 *
 * Resolution order:
 *   1. KITE_MEMORY_DIR env var if set
 *   2. ~/.kite/
 */
export function getMemoryBaseDir(): string {
  if (process.env.KITE_MEMORY_DIR) {
    return process.env.KITE_MEMORY_DIR
  }
  return join(homedir(), KITE_CONFIG_DIR)
}

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
export function validateMemoryPath(
  raw: string | undefined,
  expandTilde: boolean,
): string | undefined {
  if (!raw) {
    return undefined
  }
  let candidate = raw

  // Tilde expansion: only when explicitly requested and the remainder is
  // non-trivial (not just "~", "~/", "~/.", "~/..").
  if (
    expandTilde &&
    (candidate.startsWith('~/') || candidate.startsWith('~\\'))
  ) {
    const rest = candidate.slice(2)
    // Reject trivial remainders that would expand to $HOME or an ancestor.
    // normalize('') = '.', normalize('.') = '.', normalize('foo/..') = '.',
    // normalize('..') = '..', normalize('foo/../..') = '..'
    const restNorm = normalize(rest || '.')
    if (restNorm === '.' || restNorm === '..') {
      return undefined
    }
    candidate = join(homedir(), rest)
  }

  // normalize() may preserve a trailing separator; strip before adding
  // exactly one to match the trailing-sep contract of getAutoMemPath().
  const normalized = normalize(candidate).replace(/[/\\]+$/, '')

  if (
    !isAbsolute(normalized) ||
    normalized.length < 3 ||
    normalized.startsWith('\\\\') ||
    normalized.startsWith('//') ||
    normalized.includes('\0')
  ) {
    return undefined
  }

  return (normalized + sep).normalize('NFC')
}

/**
 * Sanitize a path for use as a directory name.
 *
 * - Replaces path separators (/ and \) with underscores
 * - Replaces colons with underscores
 * - Removes leading dots (prevents hidden directories)
 * - Trims to 200 chars max; when truncated, appends a hash suffix for
 *   uniqueness so two long paths that share a 200-char prefix don't collide.
 */
export function sanitizePath(p: string): string {
  const sanitized = p
    .replace(/[/\\]/g, '_')
    .replace(/:/g, '_')
    .replace(/^\.+/, '')

  if (sanitized.length <= MAX_SANITIZED_LENGTH) {
    return sanitized
  }

  const hash = Math.abs(djb2Hash(p)).toString(36)
  return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${hash}`
}

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
export function getAutoMemPath(projectRoot?: string): string {
  const root = projectRoot ?? process.cwd()
  const cached = _autoMemPathCache.get(root)
  if (cached !== undefined) {
    return cached
  }

  // 1. Full env-var override
  const envOverride = validateMemoryPath(
    process.env.KITE_MEMORY_PATH_OVERRIDE,
    false,
  )
  if (envOverride) {
    _autoMemPathCache.set(root, envOverride)
    return envOverride
  }

  // 2. Settings override (user-level only, supports ~/ expansion)
  const settingsDir = readAutoMemoryDirectoryFromSettings()
  const settingsOverride = validateMemoryPath(settingsDir, true)
  if (settingsOverride) {
    _autoMemPathCache.set(root, settingsOverride)
    return settingsOverride
  }

  // 3. Default: {memoryBase}/projects/{sanitized-cwd}/memory/
  const projectsDir = join(getMemoryBaseDir(), 'projects')
  const result = (
    join(projectsDir, sanitizePath(root), AUTO_MEM_DIRNAME) + sep
  ).normalize('NFC')

  _autoMemPathCache.set(root, result)
  return result
}

/**
 * Returns the auto-memory entrypoint (MEMORY.md inside the auto-memory dir).
 * Follows the same resolution order as getAutoMemPath().
 */
export function getAutoMemEntrypoint(projectRoot?: string): string {
  return join(getAutoMemPath(projectRoot), AUTO_MEM_ENTRYPOINT_NAME)
}

/**
 * Returns the daily log file path for the given date (defaults to today).
 * Shape: {autoMemPath}/logs/YYYY/MM/YYYY-MM-DD.md
 */
export function getAutoMemDailyLogPath(date: Date = new Date()): string {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return join(getAutoMemPath(), 'logs', yyyy, mm, `${yyyy}-${mm}-${dd}.md`)
}

/**
 * Check if an absolute path is within the auto-memory directory.
 * Normalizes both paths before comparison to prevent traversal bypasses
 * via .. segments or redundant separators.
 */
export function isAutoMemPath(absolutePath: string): boolean {
  const normalizedPath = normalize(absolutePath)
  return normalizedPath.startsWith(getAutoMemPath())
}

/**
 * Returns true if KITE_MEMORY_PATH_OVERRIDE env var is set to a valid path.
 * Use this as a signal that the caller has explicitly opted into
 * the auto-memory mechanics.
 */
export function hasAutoMemPathOverride(): boolean {
  return (
    validateMemoryPath(process.env.KITE_MEMORY_PATH_OVERRIDE, false) !==
    undefined
  )
}

// ---------------------------------------------------------------------------
// Cache management (for testing)
// ---------------------------------------------------------------------------

/**
 * Clear the memoization cache for getAutoMemPath. Exposed for tests that
 * change env vars or settings between assertions.
 */
export function _clearAutoMemPathCache(): void {
  _autoMemPathCache.clear()
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AUTO_MEM_DIRNAME, AUTO_MEM_ENTRYPOINT_NAME, KITE_CONFIG_DIR }
