/**
 * BashPermissionRequest — Permission dialog for shell command execution.
 *
 * Shows the command in a code box with allow/deny/always-allow choices.
 * Highlights dangerous commands (rm, sudo, etc.) in red.
 * Uses y/n/a quick keys matching the PermissionRequest pattern.
 */
import React from 'react';
export interface BashPermissionRequestProps {
    command: string;
    description?: string;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways: () => void;
    isActive?: boolean;
}
export declare const BashPermissionRequest: React.FC<BashPermissionRequestProps>;
export default BashPermissionRequest;
//# sourceMappingURL=BashPermissionRequest.d.ts.map