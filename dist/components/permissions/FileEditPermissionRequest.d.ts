/**
 * FileEditPermissionRequest — Permission dialog for file edit operations.
 *
 * Shows an inline diff with red/green lines for removed/added content,
 * with allow/deny/always-allow choices.
 */
import React from 'react';
export interface FileEditPermissionRequestProps {
    filePath: string;
    oldString: string;
    newString: string;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways: () => void;
    isActive?: boolean;
}
export declare const FileEditPermissionRequest: React.FC<FileEditPermissionRequestProps>;
export default FileEditPermissionRequest;
//# sourceMappingURL=FileEditPermissionRequest.d.ts.map