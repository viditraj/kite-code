import { existsSync, readFileSync, statSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { join, resolve, dirname, basename, relative } from 'path'

/**
 * Walk up from startPath (or cwd) looking for a .git directory or .git file (worktree).
 * Returns the directory containing .git, or null if not found.
 */
export function findGitRoot(startPath?: string): string | null {
  let current = resolve(startPath || process.cwd())

  while (true) {
    const gitPath = join(current, '.git')

    if (existsSync(gitPath)) {
      // .git can be a directory (normal repo) or a file (worktree/submodule)
      const stat = statSync(gitPath)
      if (stat.isDirectory() || stat.isFile()) {
        return current
      }
    }

    const parent = dirname(current)
    if (parent === current) {
      // Reached filesystem root
      return null
    }
    current = parent
  }
}

/**
 * Find the canonical git root (for worktrees, this is the main repo).
 * If .git is a file (worktree), follows the gitdir pointer to find
 * the actual .git directory and returns the canonical root.
 */
export function findCanonicalGitRoot(startPath?: string): string | null {
  const gitRoot = findGitRoot(startPath)
  if (!gitRoot) {
    return null
  }

  const gitPath = join(gitRoot, '.git')
  const stat = statSync(gitPath)

  if (stat.isDirectory()) {
    // Normal repo — check for commondir (linked worktree setup)
    const commondirPath = join(gitPath, 'commondir')
    if (existsSync(commondirPath)) {
      const commondir = readFileSync(commondirPath, 'utf-8').trim()
      const resolvedCommondir = resolve(gitPath, commondir)
      return dirname(resolvedCommondir)
    }
    return gitRoot
  }

  if (stat.isFile()) {
    // Worktree or submodule — .git file contains "gitdir: <path>"
    const content = readFileSync(gitPath, 'utf-8').trim()
    const match = content.match(/^gitdir:\s*(.+)$/)
    if (!match) {
      return gitRoot
    }

    const gitdir = resolve(gitRoot, match[1])

    // For worktrees, the gitdir points to .git/worktrees/<name>
    // The commondir file points back to the main .git directory
    const commondirPath = join(gitdir, 'commondir')
    if (existsSync(commondirPath)) {
      const commondir = readFileSync(commondirPath, 'utf-8').trim()
      const resolvedCommondir = resolve(gitdir, commondir)
      return dirname(resolvedCommondir)
    }

    // For submodules, the gitdir points to the parent's .git/modules/<name>
    // The canonical root is the parent of the actual .git dir
    const parentGitDir = dirname(gitdir)
    if (basename(parentGitDir) === 'modules') {
      return dirname(dirname(parentGitDir))
    }

    return dirname(gitdir)
  }

  return null
}

/**
 * Resolve a git ref (e.g. "refs/heads/main") to a full SHA.
 * Checks loose refs first, then falls back to packed-refs.
 */
export function resolveRef(gitDir: string, ref: string): string | null {
  // Check loose ref file
  const looseRefPath = join(gitDir, ref)
  if (existsSync(looseRefPath)) {
    try {
      const stat = statSync(looseRefPath)
      if (stat.isFile()) {
        const content = readFileSync(looseRefPath, 'utf-8').trim()
        // Validate it looks like a SHA (40 hex chars)
        if (/^[0-9a-f]{40}$/i.test(content)) {
          return content
        }
      }
    } catch {
      // Fall through to packed-refs
    }
  }

  // Check packed-refs
  const packedRefsPath = join(gitDir, 'packed-refs')
  if (existsSync(packedRefsPath)) {
    try {
      const content = readFileSync(packedRefsPath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        // Skip comments and peel lines
        if (line.startsWith('#') || line.startsWith('^') || line.trim() === '') {
          continue
        }

        // Format: <sha> <refname>
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2 && parts[1] === ref) {
          return parts[0]
        }
      }
    } catch {
      // Ignore errors reading packed-refs
    }
  }

  return null
}

/**
 * Locate the .git directory for a given working directory.
 * Handles both normal repos and worktrees/submodules.
 */
function getGitDir(cwd?: string): string | null {
  const root = findGitRoot(cwd)
  if (!root) {
    return null
  }

  const gitPath = join(root, '.git')
  const stat = statSync(gitPath)

  if (stat.isDirectory()) {
    return gitPath
  }

  if (stat.isFile()) {
    const content = readFileSync(gitPath, 'utf-8').trim()
    const match = content.match(/^gitdir:\s*(.+)$/)
    if (match) {
      return resolve(root, match[1])
    }
  }

  return null
}

/**
 * Get the current git branch name.
 * Returns abbreviated SHA (first 8 chars) if in detached HEAD state.
 * Returns null if not in a git repo.
 */
export function getGitBranch(cwd?: string): string | null {
  const gitDir = getGitDir(cwd)
  if (!gitDir) {
    return null
  }

  const headPath = join(gitDir, 'HEAD')
  if (!existsSync(headPath)) {
    return null
  }

  try {
    const content = readFileSync(headPath, 'utf-8').trim()

    // Check if HEAD points to a branch ref
    const refMatch = content.match(/^ref:\s*refs\/heads\/(.+)$/)
    if (refMatch) {
      return refMatch[1]
    }

    // Detached HEAD — content is a SHA
    if (/^[0-9a-f]{40}$/i.test(content)) {
      return content.substring(0, 8)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the current commit SHA (full 40-char hex string).
 * Resolves symbolic refs through to the actual commit SHA.
 * Returns null if not in a git repo.
 */
export function getGitSHA(cwd?: string): string | null {
  const gitDir = getGitDir(cwd)
  if (!gitDir) {
    return null
  }

  const headPath = join(gitDir, 'HEAD')
  if (!existsSync(headPath)) {
    return null
  }

  try {
    const content = readFileSync(headPath, 'utf-8').trim()

    // Check if HEAD points to a ref
    const refMatch = content.match(/^ref:\s*(.+)$/)
    if (refMatch) {
      const ref = refMatch[1]
      return resolveRef(gitDir, ref)
    }

    // Detached HEAD — content is a SHA directly
    if (/^[0-9a-f]{40}$/i.test(content)) {
      return content
    }

    return null
  } catch {
    return null
  }
}

/**
 * Run `git status --short` and return the trimmed output.
 * Returns empty string on error.
 */
export function getGitStatus(cwd?: string): string {
  try {
    const effectiveCwd = cwd || process.cwd()
    const output = execSync('git status --short', {
      cwd: effectiveCwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.trim()
  } catch {
    return ''
  }
}

/**
 * Run `git diff` (or `git diff --staged`) and return the trimmed output.
 * Returns empty string on error.
 */
export function getGitDiff(cwd?: string, staged?: boolean): string {
  try {
    const effectiveCwd = cwd || process.cwd()
    const command = staged ? 'git diff --staged' : 'git diff'
    const output = execSync(command, {
      cwd: effectiveCwd,
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.trim()
  } catch {
    return ''
  }
}

/**
 * Run `git log --oneline -N` and return the trimmed output.
 * Default count is 10.
 * Returns empty string on error.
 */
export function getGitLog(cwd?: string, count?: number): string {
  try {
    const effectiveCwd = cwd || process.cwd()
    const n = count ?? 10
    const output = execSync(`git log --oneline -${n}`, {
      cwd: effectiveCwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.trim()
  } catch {
    return ''
  }
}

/**
 * Check if the given directory is inside a git repository.
 */
export function isGitRepo(cwd?: string): boolean {
  return findGitRoot(cwd) !== null
}

/**
 * Check if the repository is a shallow clone by looking for `.git/shallow`.
 */
export function isShallowRepo(cwd?: string): boolean {
  const gitDir = getGitDir(cwd)
  if (!gitDir) {
    return false
  }

  return existsSync(join(gitDir, 'shallow'))
}

/**
 * Get the remote URL for "origin".
 * Returns null on error or if no origin remote exists.
 */
export function getGitRemoteUrl(cwd?: string): string | null {
  try {
    const effectiveCwd = cwd || process.cwd()
    const output = execSync('git remote get-url origin', {
      cwd: effectiveCwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const trimmed = output.trim()
    return trimmed || null
  } catch {
    return null
  }
}

/**
 * Get list of modified (unstaged) files.
 * Returns an array of file paths.
 */
export function getModifiedFiles(cwd?: string): string[] {
  try {
    const effectiveCwd = cwd || process.cwd()
    const output = execSync('git diff --name-only', {
      cwd: effectiveCwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
  } catch {
    return []
  }
}

/**
 * Get list of staged files.
 * Returns an array of file paths.
 */
export function getStagedFiles(cwd?: string): string[] {
  try {
    const effectiveCwd = cwd || process.cwd()
    const output = execSync('git diff --staged --name-only', {
      cwd: effectiveCwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
  } catch {
    return []
  }
}

/**
 * Check if a path is gitignored.
 * Returns true if the path is ignored by git, false otherwise.
 */
export function isPathGitignored(filePath: string, cwd?: string): boolean {
  try {
    const effectiveCwd = cwd || process.cwd()
    execSync(`git check-ignore -q ${JSON.stringify(filePath)}`, {
      cwd: effectiveCwd,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // Exit code 0 means the path IS ignored
    return true
  } catch {
    // Non-zero exit code means the path is NOT ignored (or an error occurred)
    return false
  }
}

/**
 * Represents the state of the git HEAD pointer.
 */
export interface GitHeadState {
  branch: string | null
  sha: string | null
  isDetached: boolean
  isDirty: boolean
}

/**
 * Get the combined HEAD state including branch, SHA, detached status, and dirty status.
 */
export function getGitHeadState(cwd?: string): GitHeadState {
  const gitDir = getGitDir(cwd)
  if (!gitDir) {
    return {
      branch: null,
      sha: null,
      isDetached: false,
      isDirty: false,
    }
  }

  const headPath = join(gitDir, 'HEAD')
  let branch: string | null = null
  let sha: string | null = null
  let isDetached = false

  if (existsSync(headPath)) {
    try {
      const content = readFileSync(headPath, 'utf-8').trim()

      const refMatch = content.match(/^ref:\s*refs\/heads\/(.+)$/)
      if (refMatch) {
        branch = refMatch[1]
        // Resolve the ref to get the SHA
        const fullRef = `refs/heads/${branch}`
        sha = resolveRef(gitDir, fullRef)
      } else if (/^[0-9a-f]{40}$/i.test(content)) {
        // Detached HEAD
        isDetached = true
        sha = content
      }
    } catch {
      // Ignore read errors
    }
  }

  // Check dirty status via git status
  const status = getGitStatus(cwd)
  const isDirty = status.length > 0

  return {
    branch,
    sha,
    isDetached,
    isDirty,
  }
}
