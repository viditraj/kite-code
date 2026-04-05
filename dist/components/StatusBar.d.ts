/**
 * StatusBar — Bottom status line with model, context usage, git, and controls.
 *
 * Shows: [MODE] model │ branch │ N msgs │ Xk/128k tokens (Y%) │ Ctrl+C
 */
import React from 'react';
export interface StatusBarProps {
    model: string;
    provider: string;
    isLoading: boolean;
    messageCount: number;
    tokenCount: number;
    gitBranch?: string | null;
    columns: number;
}
export declare const StatusBar: React.FC<StatusBarProps>;
//# sourceMappingURL=StatusBar.d.ts.map