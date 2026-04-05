/**
 * NotebookEditPermissionRequest — Permission dialog for Jupyter notebook edits.
 *
 * Shows the notebook path, cell number, and edit mode with
 * allow/deny/always-allow choices.
 */
import React from 'react';
export interface NotebookEditPermissionRequestProps {
    notebookPath: string;
    cellNumber: number;
    editMode: string;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways: () => void;
    isActive?: boolean;
}
export declare const NotebookEditPermissionRequest: React.FC<NotebookEditPermissionRequestProps>;
export default NotebookEditPermissionRequest;
//# sourceMappingURL=NotebookEditPermissionRequest.d.ts.map