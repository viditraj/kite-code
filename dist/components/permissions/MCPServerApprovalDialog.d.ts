/**
 * MCPServerApprovalDialog — Approval dialog for MCP server connections.
 *
 * Shows server details (name, type) with approve/deny choices.
 * Uses y/n quick keys matching the PermissionRequest pattern.
 */
import React from 'react';
export interface MCPServerApprovalDialogProps {
    serverName: string;
    serverType: string;
    onApprove: () => void;
    onDeny: () => void;
    isActive?: boolean;
}
export declare const MCPServerApprovalDialog: React.FC<MCPServerApprovalDialogProps>;
export default MCPServerApprovalDialog;
//# sourceMappingURL=MCPServerApprovalDialog.d.ts.map