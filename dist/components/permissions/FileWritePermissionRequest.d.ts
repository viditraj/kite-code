/**
 * FileWritePermissionRequest — Permission dialog for file write operations.
 *
 * Shows the file path and a preview of the first 10 lines of content
 * in a preview box, with allow/deny/always-allow choices.
 */
import React from 'react';
export interface FileWritePermissionRequestProps {
    filePath: string;
    contentPreview: string;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways: () => void;
    isActive?: boolean;
}
export declare const FileWritePermissionRequest: React.FC<FileWritePermissionRequestProps>;
export default FileWritePermissionRequest;
//# sourceMappingURL=FileWritePermissionRequest.d.ts.map