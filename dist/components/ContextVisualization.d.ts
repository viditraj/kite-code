/**
 * ContextVisualization — Token usage display with segmented progress bar.
 *
 * Shows a horizontal bar with color segments for input (cyan)
 * and output (green) tokens, plus percentage label. Inspired by
 * Claude Code's ContextVisualization but simplified for Kite.
 */
import React from 'react';
export interface ContextVisualizationProps {
    /** Total tokens used so far. */
    usedTokens: number;
    /** Maximum tokens in the context window. */
    maxTokens: number;
    /** Tokens consumed by input/prompt. */
    inputTokens: number;
    /** Tokens consumed by output/response. */
    outputTokens: number;
}
export declare function ContextVisualization({ usedTokens, maxTokens, inputTokens, outputTokens, }: ContextVisualizationProps): React.ReactElement;
//# sourceMappingURL=ContextVisualization.d.ts.map