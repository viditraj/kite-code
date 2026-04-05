/**
 * Doctor Screen — System diagnostics display.
 *
 * Implements the same diagnostic checks as Claude Code's Doctor.tsx:
 * - Environment info (Node.js, platform, architecture)
 * - Provider connectivity test
 * - Configuration validation
 * - Git status
 * - MCP server status
 * - Memory/session storage status
 * - Permission settings
 */
import React from 'react';
import type { LLMProvider } from '../providers/types.js';
import type { KiteConfig } from '../utils/config.js';
export interface DoctorProps {
    config: KiteConfig;
    provider: LLMProvider;
    onDone?: (result?: string) => void;
}
export declare const Doctor: React.FC<DoctorProps>;
//# sourceMappingURL=Doctor.d.ts.map