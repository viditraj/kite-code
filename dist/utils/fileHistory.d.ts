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
export interface FileBackup {
    filePath: string;
    backupPath: string | null;
    version: number;
    timestamp: number;
    hash: string;
}
export interface FileHistoryState {
    sessionId: string;
    snapshots: FileBackup[];
    versionCounters: Record<string, number>;
}
export declare function initFileHistory(sessionId: string): void;
export declare function getFileHistoryState(): FileHistoryState | null;
/**
 * Save the current state of a file before modifying it.
 * Call this BEFORE any write/edit operation.
 * Returns the backup entry, or null if the file doesn't exist.
 */
export declare function backupFileBeforeEdit(filePath: string): FileBackup | null;
/**
 * Restore a file to its previous version.
 * Returns true if successful.
 */
export declare function restoreFile(filePath: string): boolean;
/**
 * Get the history of changes for a specific file.
 */
export declare function getFileHistory(filePath: string): FileBackup[];
/**
 * Get all tracked files in this session.
 */
export declare function getTrackedFiles(): string[];
/**
 * Get total number of snapshots.
 */
export declare function getSnapshotCount(): number;
//# sourceMappingURL=fileHistory.d.ts.map