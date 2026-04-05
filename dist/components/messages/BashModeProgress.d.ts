/**
 * BashModeProgress — Live-updating shell command progress display.
 *
 * Shows the command being executed, elapsed time, total bytes processed,
 * and a preview of the output in a bordered box.
 */
import React from 'react';
export interface BashModeProgressProps {
    command: string;
    output: string;
    elapsed: number;
    totalBytes: number;
}
export declare const BashModeProgress: React.FC<BashModeProgressProps>;
export default BashModeProgress;
//# sourceMappingURL=BashModeProgress.d.ts.map