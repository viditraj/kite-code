/**
 * Table — Simple text-mode table rendered with ink Box / Text.
 *
 * Columns are auto-sized to fit the widest cell in each column.
 * Headers are rendered in bold, with an optional border style
 * around the table.
 */
import React from 'react';
export interface TableProps {
    /** Column header labels. */
    headers: string[];
    /** Row data — each inner array must have the same length as `headers`. */
    rows: string[][];
    /** ink borderStyle applied to the outer Box. Defaults to 'single'. */
    borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
}
export declare function Table({ headers, rows, borderStyle, }: TableProps): React.ReactElement;
//# sourceMappingURL=Table.d.ts.map