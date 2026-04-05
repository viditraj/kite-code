import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
function computeDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result = [];
    // Simple LCS-based diff
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
    // Backtrack to build diff
    const diffOps = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diffOps.unshift({ type: 'context', line: oldLines[i - 1] });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diffOps.unshift({ type: 'added', line: newLines[j - 1] });
            j--;
        }
        else if (i > 0) {
            diffOps.unshift({ type: 'removed', line: oldLines[i - 1] });
            i--;
        }
    }
    // Assign line numbers
    let oldLineNo = 1;
    let newLineNo = 1;
    for (const op of diffOps) {
        switch (op.type) {
            case 'context':
                result.push({ type: 'context', text: op.line, oldLineNo, newLineNo });
                oldLineNo++;
                newLineNo++;
                break;
            case 'removed':
                result.push({ type: 'removed', text: op.line, oldLineNo });
                oldLineNo++;
                break;
            case 'added':
                result.push({ type: 'added', text: op.line, newLineNo });
                newLineNo++;
                break;
        }
    }
    return result;
}
function padLineNo(num, width) {
    if (num === undefined)
        return ' '.repeat(width);
    const s = String(num);
    return ' '.repeat(Math.max(0, width - s.length)) + s;
}
// ============================================================================
// FileEditToolDiff Component
// ============================================================================
export const FileEditToolDiff = ({ filePath, oldContent, newContent, }) => {
    const diffLines = computeDiff(oldContent, newContent);
    // Calculate line number gutter width
    const maxLineNo = diffLines.reduce((max, l) => Math.max(max, l.oldLineNo ?? 0, l.newLineNo ?? 0), 0);
    const gutterWidth = Math.max(String(maxLineNo).length, 3);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: '\u2500\u2500\u2500 ' }), _jsx(Text, { color: "cyan", bold: true, children: filePath })] }), _jsx(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, children: diffLines.map((line, idx) => {
                    const lineNo = line.type === 'removed'
                        ? padLineNo(line.oldLineNo, gutterWidth)
                        : line.type === 'added'
                            ? padLineNo(line.newLineNo, gutterWidth)
                            : padLineNo(line.oldLineNo, gutterWidth);
                    const prefix = line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' ';
                    const color = line.type === 'removed'
                        ? 'red'
                        : line.type === 'added'
                            ? 'green'
                            : undefined;
                    return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [lineNo, " "] }), _jsxs(Text, { color: color, children: [prefix, " ", line.text] })] }, idx));
                }) })] }));
};
export default FileEditToolDiff;
//# sourceMappingURL=FileEditToolDiff.js.map