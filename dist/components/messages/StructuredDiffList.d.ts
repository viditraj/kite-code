/**
 * StructuredDiffList — Summary list of changed files with +/- counts.
 *
 * Shows each file's status (added/modified/deleted) with color coding
 * and addition/deletion counts.
 */
import React from 'react';
export interface FileChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
}
export interface StructuredDiffListProps {
    files: FileChange[];
}
export declare const StructuredDiffList: React.FC<StructuredDiffListProps>;
export default StructuredDiffList;
//# sourceMappingURL=StructuredDiffList.d.ts.map