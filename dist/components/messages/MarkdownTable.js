import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// Helpers
// ============================================================================
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
function padCell(text, width, align) {
    if (text.length >= width)
        return text;
    const diff = width - text.length;
    switch (align) {
        case 'right':
            return ' '.repeat(diff) + text;
        case 'center': {
            const left = Math.floor(diff / 2);
            const right = diff - left;
            return ' '.repeat(left) + text + ' '.repeat(right);
        }
        case 'left':
        default:
            return text + ' '.repeat(diff);
    }
}
// ============================================================================
// MarkdownTable Component
// ============================================================================
export const MarkdownTable = ({ headers, rows, alignments, }) => {
    const colWidths = computeColumnWidths(headers, rows);
    const colCount = headers.length;
    // Build separator line
    const separator = colWidths
        .map((w) => '\u2500'.repeat(w + 2))
        .join('\u253C');
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { children: headers.map((header, i) => {
                    const align = alignments?.[i] ?? 'left';
                    return (_jsxs(Box, { children: [i > 0 && _jsx(Text, { dimColor: true, children: '\u2502' }), _jsxs(Text, { bold: true, children: [" ", padCell(header, colWidths[i], align), " "] })] }, i));
                }) }), _jsx(Box, { children: _jsx(Text, { dimColor: true, children: separator }) }), rows.map((row, rowIdx) => (_jsx(Box, { children: row.map((cell, colIdx) => {
                    const align = alignments?.[colIdx] ?? 'left';
                    return (_jsxs(Box, { children: [colIdx > 0 && _jsx(Text, { dimColor: true, children: '\u2502' }), _jsxs(Text, { children: [" ", padCell(cell ?? '', colWidths[colIdx], align), " "] })] }, colIdx));
                }) }, rowIdx)))] }));
};
export default MarkdownTable;
//# sourceMappingURL=MarkdownTable.js.map