/**
 * CompactSummary — Collapsible text display.
 *
 * Shows first N lines of content, then a dim indicator showing
 * how many additional lines are hidden.
 */
import React from 'react';
export interface CompactSummaryProps {
    content: string;
    maxLines?: number;
    expanded?: boolean;
}
export declare const CompactSummary: React.FC<CompactSummaryProps>;
export default CompactSummary;
//# sourceMappingURL=CompactSummary.d.ts.map