/**
 * FilePathLink — Styled file path display.
 *
 * Shows path in cyan with dimmed directory parts and bold filename.
 * Optionally appends :lineNumber.
 */
import React from 'react';
export interface FilePathLinkProps {
    path: string;
    lineNumber?: number;
}
export declare const FilePathLink: React.FC<FilePathLinkProps>;
export default FilePathLink;
//# sourceMappingURL=FilePathLink.d.ts.map