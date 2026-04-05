/**
 * Settings — tabbed settings dialog with system status, configuration,
 * and usage statistics.
 *
 * Provides diagnostics, config introspection, and token/cost tracking
 * in a navigable multi-tab layout.
 */
import React from 'react';
export type SettingsTab = 'status' | 'config' | 'usage';
export interface SettingsProps {
    onClose: (result?: string) => void;
    config: Record<string, unknown>;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
    };
    model?: string;
    provider?: string;
}
export interface DiagnosticItem {
    label: string;
    value: string;
    status: 'ok' | 'warning' | 'error';
}
/**
 * Build an array of system diagnostic items for the status tab.
 */
export declare function buildDiagnostics(): DiagnosticItem[];
export interface StatusTabProps {
    diagnostics: DiagnosticItem[];
}
export declare const StatusTab: React.FC<StatusTabProps>;
export interface ConfigTabProps {
    config: Record<string, unknown>;
    onClose: (result?: string) => void;
}
export declare const ConfigTab: React.FC<ConfigTabProps>;
export interface UsageTabProps {
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
    };
    model?: string;
}
export declare const UsageTab: React.FC<UsageTabProps>;
export declare const Settings: React.FC<SettingsProps>;
//# sourceMappingURL=Settings.d.ts.map