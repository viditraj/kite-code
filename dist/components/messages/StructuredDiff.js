import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// Diff Algorithm (simple LCS-based)
// ============================================================================
function computeUnifiedDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result = [];
    const m = oldLines.length;
    const n = newLines.length;
    // Build LCS table
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack
    const ops = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            ops.unshift({ type: 'context', line: oldLines[i - 1] });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.unshift({ type: 'added', line: newLines[j - 1] });
            j--;
        }
        else if (i > 0) {
            ops.unshift({ type: 'removed', line: oldLines[i - 1] });
            i--;
        }
    }
    // Assign line numbers
    let oldLineNo = 1;
    let newLineNo = 1;
    for (const op of ops) {
        switch (op.type) {
            case 'context':
                result.push({ type: 'context', line: op.line, oldLineNo, newLineNo });
                oldLineNo++;
                newLineNo++;
                break;
            case 'removed':
                result.push({ type: 'removed', line: op.line, oldLineNo });
                oldLineNo++;
                break;
            case 'added':
                result.push({ type: 'added', line: op.line, newLineNo });
                newLineNo++;
                break;
        }
    }
    return result;
}
// ============================================================================
// Helpers
// ============================================================================
function padNum(num, width) {
    if (num === undefined)
        return ' '.repeat(width);
    const s = String(num);
    return ' '.repeat(Math.max(0, width - s.length)) + s;
}
// ============================================================================
// StructuredDiff Component
// ============================================================================
export const StructuredDiff = ({ oldContent, newContent, filePath, mode = 'unified', }) => {
    const hunks = computeUnifiedDiff(oldContent, newContent);
    // Calculate gutter widths
    const maxOldLine = hunks.reduce((max, h) => Math.max(max, h.oldLineNo ?? 0), 0);
    const maxNewLine = hunks.reduce((max, h) => Math.max(max, h.newLineNo ?? 0), 0);
    const gutterWidth = Math.max(String(Math.max(maxOldLine, maxNewLine)).length, 3);
    if (mode === 'split') {
        return (_jsxs(Box, { flexDirection: "column", children: [filePath && (_jsx(Box, { children: _jsx(Text, { color: "cyan", bold: true, children: filePath }) })), _jsx(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, children: hunks.map((hunk, idx) => {
                        const oldNum = padNum(hunk.oldLineNo, gutterWidth);
                        const newNum = padNum(hunk.newLineNo, gutterWidth);
                        if (hunk.type === 'context') {
                            return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [oldNum, " "] }), _jsx(Text, { children: hunk.line }), _jsx(Text, { children: '  ' }), _jsxs(Text, { color: "gray", children: [newNum, " "] }), _jsx(Text, { children: hunk.line })] }, idx));
                        }
                        if (hunk.type === 'removed') {
                            return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [oldNum, " "] }), _jsxs(Text, { color: "red", children: ['- ', hunk.line] }), _jsx(Text, { children: '  ' }), _jsxs(Text, { color: "gray", children: [' '.repeat(gutterWidth), " "] }), _jsx(Text, { children: ' ' })] }, idx));
                        }
                        // added
                        return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [' '.repeat(gutterWidth), " "] }), _jsx(Text, { children: ' ' }), _jsx(Text, { children: '  ' }), _jsxs(Text, { color: "gray", children: [newNum, " "] }), _jsxs(Text, { color: "green", children: ['+ ', hunk.line] })] }, idx));
                    }) })] }));
    }
    // Unified mode (default)
    return (_jsxs(Box, { flexDirection: "column", children: [filePath && (_jsx(Box, { children: _jsx(Text, { color: "cyan", bold: true, children: filePath }) })), _jsx(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, children: hunks.map((hunk, idx) => {
                    const lineNo = hunk.type === 'removed'
                        ? padNum(hunk.oldLineNo, gutterWidth)
                        : hunk.type === 'added'
                            ? padNum(hunk.newLineNo, gutterWidth)
                            : padNum(hunk.oldLineNo, gutterWidth);
                    const prefix = hunk.type === 'removed' ? '-' : hunk.type === 'added' ? '+' : ' ';
                    const color = hunk.type === 'removed'
                        ? 'red'
                        : hunk.type === 'added'
                            ? 'green'
                            : undefined;
                    return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [lineNo, " "] }), _jsxs(Text, { color: color, children: [prefix, " ", hunk.line] })] }, idx));
                }) })] }));
};
export default StructuredDiff;
//# sourceMappingURL=StructuredDiff.js.map