/**
 * FileChange — Git-style file change indicator.
 *
 * Shows a file path with a colour-coded status badge and optional
 * addition / deletion counts, similar to `git diff --stat`.
 */
import React from 'react';
export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';
export interface FileChangeProps {
    /** File path to display. */
    path: string;
    /** Kind of change. */
    status: FileChangeStatus;
    /** Number of added lines. */
    additions?: number;
    /** Number of deleted lines. */
    deletions?: number;
}
export declare function FileChange({ path, status, additions, deletions, }: FileChangeProps): React.ReactElement;
//# sourceMappingURL=FileChange.d.ts.map