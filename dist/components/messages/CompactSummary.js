import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// CompactSummary Component
// ============================================================================
export const CompactSummary = ({ content, maxLines = 5, expanded = false, }) => {
    const lines = content.split('\n');
    const totalLines = lines.length;
    if (expanded || totalLines <= maxLines) {
        return (_jsx(Box, { flexDirection: "column", children: lines.map((line, i) => (_jsx(Text, { children: line }, i))) }));
    }
    const visibleLines = lines.slice(0, maxLines);
    const hiddenCount = totalLines - maxLines;
    return (_jsxs(Box, { flexDirection: "column", children: [visibleLines.map((line, i) => (_jsx(Text, { children: line }, i))), _jsxs(Text, { dimColor: true, children: ['... (', hiddenCount, ' more line', hiddenCount !== 1 ? 's' : '', ')'] })] }));
};
export default CompactSummary;
//# sourceMappingURL=CompactSummary.js.map