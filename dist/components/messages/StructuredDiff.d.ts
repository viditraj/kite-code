/**
 * StructuredDiff — Full diff view with unified or split mode.
 *
 * Uses a simple LCS-based diff algorithm to compute changes between
 * old and new content. Unified mode shows standard -/+ format.
 * Green additions, red deletions, gray context lines.
 */
import React from 'react';
export interface StructuredDiffProps {
    oldContent: string;
    newContent: string;
    filePath?: string;
    mode?: 'unified' | 'split';
}
export declare const StructuredDiff: React.FC<StructuredDiffProps>;
export default StructuredDiff;
//# sourceMappingURL=StructuredDiff.d.ts.map