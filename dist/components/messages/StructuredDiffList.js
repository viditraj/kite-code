import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const STATUS_CONFIG = {
    added: { icon: '+', color: 'green', label: 'added' },
    modified: { icon: '~', color: 'yellow', label: 'modified' },
    deleted: { icon: '-', color: 'red', label: 'deleted' },
    renamed: { icon: '>', color: 'cyan', label: 'renamed' },
};
// ============================================================================
// Helpers
// ============================================================================
function buildChangeBars(additions, deletions, maxWidth) {
    const total = additions + deletions;
    if (total === 0) {
        return _jsx(Text, { dimColor: true, children: '\u2500' });
    }
    const barWidth = Math.min(total, maxWidth);
    const addBars = total > 0 ? Math.max(1, Math.round((additions / total) * barWidth)) : 0;
    const delBars = barWidth - addBars;
    return (_jsxs(Text, { children: [_jsx(Text, { color: "green", children: '\u2588'.repeat(addBars) }), _jsx(Text, { color: "red", children: '\u2588'.repeat(delBars) })] }));
}
// ============================================================================
// StructuredDiffList Component
// ============================================================================
export const StructuredDiffList = ({ files, }) => {
    // Calculate totals
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    // Calculate max path length for alignment
    const maxPathLen = Math.max(...files.map((f) => f.path.length), 0);
    const barWidth = 20;
    return (_jsxs(Box, { flexDirection: "column", children: [files.map((file, idx) => {
                const config = STATUS_CONFIG[file.status] ?? STATUS_CONFIG['modified'];
                const paddedPath = file.path + ' '.repeat(Math.max(0, maxPathLen - file.path.length));
                return (_jsxs(Box, { children: [_jsxs(Text, { color: config.color, bold: true, children: [config.icon, " "] }), _jsxs(Text, { children: [paddedPath, " "] }), file.additions > 0 && (_jsxs(Text, { color: "green", children: ['+' + file.additions, " "] })), file.deletions > 0 && (_jsxs(Text, { color: "red", children: ['-' + file.deletions, " "] })), buildChangeBars(file.additions, file.deletions, barWidth)] }, idx));
            }), files.length > 0 && (_jsxs(Box, { marginTop: 1, children: [_jsxs(Text, { dimColor: true, children: [files.length, " file", files.length !== 1 ? 's' : '', " changed"] }), totalAdditions > 0 && (_jsxs(Text, { color: "green", children: [', +', totalAdditions, " insertion", totalAdditions !== 1 ? 's' : ''] })), totalDeletions > 0 && (_jsxs(Text, { color: "red", children: [', -', totalDeletions, " deletion", totalDeletions !== 1 ? 's' : ''] }))] }))] }));
};
export default StructuredDiffList;
//# sourceMappingURL=StructuredDiffList.js.map