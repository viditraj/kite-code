/**
 * PermissionRequest — permission prompt dialog for tool execution.
 *
 * Matches Claude Code's permission dialog pattern:
 * - Allow once / Always allow / Deny
 * - Quick keys: y/n/a
 * - Fixed-height layout to prevent border multiplication on re-render
 */
import React from 'react';
export type PermissionChoice = 'allow_once' | 'allow_always' | 'deny';
export interface PermissionRequestProps {
    toolName: string;
    description: string;
    message?: string;
    input?: Record<string, unknown>;
    onAllow: () => void;
    onDeny: () => void;
    onAllowAlways?: () => void;
    isActive?: boolean;
}
export declare const PermissionRequest: React.FC<PermissionRequestProps>;
//# sourceMappingURL=PermissionRequest.d.ts.map