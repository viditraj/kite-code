/**
 * FileHistory — Track file changes for undo support.
 *
 * Before any file write/edit, saves the original content to
 * ~/.kite/snapshots/{sessionId}/{hash}@v{version}.
 * Supports restoring previous versions via /rewind command.
 *
 * Matches Claude Code's fileHistory.ts pattern:
 * - Content-hash based dedup
 * - Monotonic version counter per file
 * - Max 100 snapshots per session
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { createHash } from 'crypto'

// ============================================================================
// Constants
// ============================================================================

const SNAPSHOTS_DIR = '.kite/snapshots'
const MAX_SNAPSHOTS = 100

// ============================================================================
// Types
// ============================================================================

export interface FileBackup {
  filePath: string
  backupPath: string | null  // null = file didn't exist before
  version: number
  timestamp: number
  hash: string
}

export interface FileHistoryState {
  sessionId: string
  snapshots: FileBackup[]
  versionCounters: Record<string, number>  // filePath → next version
}

// ============================================================================
// State (per-session, in-memory)
// ============================================================================

let state: FileHistoryState | null = null

export function initFileHistory(sessionId: string): void {
  state = {
    sessionId,
    snapshots: [],
    versionCounters: {},
  }
  // Ensure snapshot directory exists
  const dir = getSnapshotDir(sessionId)
  mkdirSync(dir, { recursive: true })
}

export function getFileHistoryState(): FileHistoryState | null {
  return state
}

// ============================================================================
// Directories
// ============================================================================

function getSnapshotDir(sessionId: string): string {
  return join(homedir(), SNAPSHOTS_DIR, sessionId)
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

// ============================================================================
// Core operations
// ============================================================================

/**
 * Save the current state of a file before modifying it.
 * Call this BEFORE any write/edit operation.
 * Returns the backup entry, or null if the file doesn't exist.
 */
export function backupFileBeforeEdit(filePath: string): FileBackup | null {
  if (!state) return null

  try {
    if (!existsSync(filePath)) {
      // File doesn't exist yet — record this as a "creation" (no backup needed)
      const version = (state.versionCounters[filePath] ?? 0) + 1
      state.versionCounters[filePath] = version

      const entry: FileBackup = {
        filePath,
        backupPath: null,
        version,
        timestamp: Date.now(),
        hash: 'new',
      }
      addSnapshot(entry)
      return entry
    }

    const content = readFileSync(filePath, 'utf-8')
    const hash = contentHash(content)
    const version = (state.versionCounters[filePath] ?? 0) + 1
    state.versionCounters[filePath] = version

    // Check if we already have this exact content backed up (dedup by hash)
    const existing = state.snapshots.find(s => s.filePath === filePath && s.hash === hash)
    if (existing) {
      // Same content — just record a new version pointing to the same backup
      const entry: FileBackup = {
        filePath,
        backupPath: existing.backupPath,
        version,
        timestamp: Date.now(),
        hash,
      }
      addSnapshot(entry)
      return entry
    }

    // Save the content to a backup file
    const backupFileName = `${hash}@v${version}`
    const backupPath = join(getSnapshotDir(state.sessionId), backupFileName)
    writeFileSync(backupPath, content, 'utf-8')

    const entry: FileBackup = {
      filePath,
      backupPath,
      version,
      timestamp: Date.now(),
      hash,
    }
    addSnapshot(entry)
    return entry
  } catch {
    return null
  }
}

/**
 * Restore a file to its previous version.
 * Returns true if successful.
 */
export function restoreFile(filePath: string): boolean {
  if (!state) return false

  // Find the most recent backup for this file
  const backups = state.snapshots
    .filter(s => s.filePath === filePath)
    .sort((a, b) => b.version - a.version)

  if (backups.length === 0) return false

  const latest = backups[0]!

  try {
    if (latest.backupPath === null) {
      // File was created — to "undo", we'd need to delete it
      // Don't delete for safety — just return false
      return false
    }

    if (!existsSync(latest.backupPath)) return false

    copyFileSync(latest.backupPath, filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get the history of changes for a specific file.
 */
export function getFileHistory(filePath: string): FileBackup[] {
  if (!state) return []
  return state.snapshots
    .filter(s => s.filePath === filePath)
    .sort((a, b) => a.version - b.version)
}

/**
 * Get all tracked files in this session.
 */
export function getTrackedFiles(): string[] {
  if (!state) return []
  return [...new Set(state.snapshots.map(s => s.filePath))]
}

/**
 * Get total number of snapshots.
 */
export function getSnapshotCount(): number {
  return state?.snapshots.length ?? 0
}

// ============================================================================
// Internal
// ============================================================================

function addSnapshot(entry: FileBackup): void {
  if (!state) return
  state.snapshots.push(entry)

  // Evict oldest if over limit
  while (state.snapshots.length > MAX_SNAPSHOTS) {
    state.snapshots.shift()
  }
}
