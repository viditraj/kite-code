import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
    added: { symbol: '+', color: 'green', label: 'new file' },
    modified: { symbol: '~', color: 'yellow', label: 'modified' },
    deleted: { symbol: '-', color: 'red', label: 'deleted' },
    renamed: { symbol: '>', color: 'cyan', label: 'renamed' },
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function FileChange({ path, status, additions, deletions, }) {
    const cfg = STATUS_CONFIG[status];
    const hasStats = additions !== undefined || deletions !== undefined;
    return (_jsxs(Box, { children: [_jsxs(Text, { color: cfg.color, bold: true, children: [' ', cfg.symbol, ' '] }), _jsx(Text, { children: path }), hasStats && (_jsx(Text, { dimColor: true, children: '  ' })), additions !== undefined && additions > 0 && (_jsx(Text, { color: "green", children: ` +${additions}` })), deletions !== undefined && deletions > 0 && (_jsx(Text, { color: "red", children: ` -${deletions}` }))] }));
}
//# sourceMappingURL=FileChange.js.map