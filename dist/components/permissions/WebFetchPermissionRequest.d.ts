/**
 * WebFetchPermissionRequest — Permission dialog for web fetch operations.
 *
 * Shows the URL being fetched with allow/deny/always-allow choices.
 * Extracts and displays the hostname prominently.
 */
import React from 'react';
export interface WebFetchPermissionRequestProps {
    url: string;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways: () => void;
    isActive?: boolean;
}
export declare const WebFetchPermissionRequest: React.FC<WebFetchPermissionRequestProps>;
export default WebFetchPermissionRequest;
//# sourceMappingURL=WebFetchPermissionRequest.d.ts.map