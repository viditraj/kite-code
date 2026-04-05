import React from 'react';
export type SpinnerMode = 'thinking' | 'working' | 'idle';
export interface SpinnerProps {
    mode?: SpinnerMode;
    message?: string;
    showElapsed?: boolean;
    startTime?: number;
}
export interface SpinnerWithVerbProps {
    verb?: string;
    color?: string;
}
export declare const SPINNER_FRAMES: string[];
export declare function Spinner({ mode, message, showElapsed, startTime, }: SpinnerProps): React.ReactElement;
export declare function SpinnerWithVerb({ verb, color, }: SpinnerWithVerbProps): React.ReactElement;
//# sourceMappingURL=Spinner.d.ts.map