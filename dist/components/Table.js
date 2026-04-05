import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Compute the max width for each column across headers and all rows. */
function computeColumnWidths(headers, rows) {
    const widths = headers.map((h) => h.length);
    for (const row of rows) {
        for (let i = 0; i < row.length; i++) {
            if (row[i] !== undefined) {
                widths[i] = Math.max(widths[i] ?? 0, row[i].length);
            }
        }
    }
    return widths;
}
function padRight(text, width) {
    if (text.length >= width)
        return text;
    return text + ' '.repeat(width - text.length);
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Table({ headers, rows, borderStyle = 'single', }) {
    const colWidths = computeColumnWidths(headers, rows);
    const colCount = headers.length;
    // Separator rendered between header and body.
    const separator = colWidths.map((w) => '\u2500'.repeat(w + 2)).join('\u253C');
    return (_jsxs(Box, { flexDirection: "column", borderStyle: borderStyle, borderColor: "gray", paddingX: 1, children: [_jsx(Box, { children: headers.map((header, i) => (_jsxs(Box, { width: colWidths[i] + 2, children: [_jsx(Text, { bold: true, children: padRight(header, colWidths[i]) }), i < colCount - 1 && _jsx(Text, { dimColor: true, children: ' \u2502' })] }, i))) }), _jsx(Box, { children: _jsx(Text, { dimColor: true, children: separator }) }), rows.map((row, rowIdx) => (_jsx(Box, { children: row.map((cell, colIdx) => (_jsxs(Box, { width: colWidths[colIdx] + 2, children: [_jsx(Text, { children: padRight(cell ?? '', colWidths[colIdx]) }), colIdx < colCount - 1 && _jsx(Text, { dimColor: true, children: ' \u2502' })] }, colIdx))) }, rowIdx)))] }));
}
//# sourceMappingURL=Table.js.map