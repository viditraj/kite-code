/**
 * MarkdownTable — Renders a markdown table with Box/Text primitives.
 *
 * Auto-calculates column widths, renders bold headers with horizontal
 * separators and vertical column dividers.
 */
import React from 'react';
export interface MarkdownTableProps {
    headers: string[];
    rows: string[][];
    alignments?: ('left' | 'center' | 'right')[];
}
export declare const MarkdownTable: React.FC<MarkdownTableProps>;
export default MarkdownTable;
//# sourceMappingURL=MarkdownTable.d.ts.map