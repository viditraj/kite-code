/**
 * ProgressBar — Horizontal progress indicator.
 *
 * Renders a bar filled with █ and ░ characters, an optional label
 * on the left, and the numeric percentage on the right.
 */
import React from 'react';
export interface ProgressBarProps {
    /** Progress percentage (0-100). Clamped internally. */
    percent: number;
    /** Total width of the bar in columns. Defaults to 40. */
    width?: number;
    /** Optional label shown before the bar. */
    label?: string;
    /** Colour for the filled portion. Defaults to 'green'. */
    color?: string;
}
export declare function ProgressBar({ percent, width, label, color, }: ProgressBarProps): React.ReactElement;
//# sourceMappingURL=ProgressBar.d.ts.map