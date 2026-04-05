import React from 'react';
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}
export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}
export interface FileDiff {
    filePath: string;
    hunks: DiffHunk[];
    isNew?: boolean;
    isDeleted?: boolean;
    isBinary?: boolean;
    isRenamed?: boolean;
    oldPath?: string;
}
export declare function computeDiffStats(diffs: FileDiff[]): {
    additions: number;
    deletions: number;
    filesChanged: number;
};
/**
 * Parse unified diff / patch text into structured FileDiff objects.
 *
 * Handles:
 *   - `diff --git a/path b/path` headers
 *   - `--- a/path` / `+++ b/path` pairs (when no `diff --git` is present)
 *   - `@@ -o,ol +n,nl @@` hunk headers
 *   - `+`, `-`, and ` ` prefixed lines
 *   - `Binary files … differ`
 *   - `new file mode`, `deleted file mode`
 *   - `rename from` / `rename to`
 */
export declare function parsePatch(patchText: string): FileDiff[];
export interface DiffLineProps {
    line: DiffLine;
    showLineNumbers?: boolean;
    lineNumWidth?: number;
    maxWidth?: number;
}
export declare const DiffLineView: React.FC<DiffLineProps>;
export interface DiffHunkViewProps {
    hunk: DiffHunk;
    showLineNumbers?: boolean;
    lineNumWidth?: number;
    maxWidth?: number;
}
export declare const DiffHunkView: React.FC<DiffHunkViewProps>;
export interface DiffFileViewProps {
    diff: FileDiff;
    showLineNumbers?: boolean;
    maxWidth?: number;
    collapsed?: boolean;
}
export declare const DiffFileView: React.FC<DiffFileViewProps>;
export interface DiffSummaryProps {
    diffs: FileDiff[];
}
export declare const DiffSummary: React.FC<DiffSummaryProps>;
export interface DiffViewProps {
    diffs: FileDiff[];
    showLineNumbers?: boolean;
    maxWidth?: number;
    showStats?: boolean;
}
export declare const DiffView: React.FC<DiffViewProps>;
//# sourceMappingURL=DiffView.d.ts.map