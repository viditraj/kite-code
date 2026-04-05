/**
 * FileEditToolDiff — Shows before/after diff for file edits.
 *
 * Removed lines in red with - prefix, added lines in green with + prefix.
 * Line numbers rendered in gray. File path displayed as a header.
 */
import React from 'react';
export interface FileEditToolDiffProps {
    filePath: string;
    oldContent: string;
    newContent: string;
}
export declare const FileEditToolDiff: React.FC<FileEditToolDiffProps>;
export default FileEditToolDiff;
//# sourceMappingURL=FileEditToolDiff.d.ts.map