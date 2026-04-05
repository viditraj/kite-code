import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const WARNING_THRESHOLD = 80;
const ERROR_THRESHOLD = 95;
// ============================================================================
// Helpers
// ============================================================================
function formatTokens(count) {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`;
    }
    return String(count);
}
function buildBar(percent, width) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}
// ============================================================================
// TokenWarning Component
// ============================================================================
export const TokenWarning = ({ percentUsed, maxTokens, }) => {
    // Don't show below warning threshold
    if (percentUsed < WARNING_THRESHOLD) {
        return null;
    }
    const isError = percentUsed >= ERROR_THRESHOLD;
    const color = isError ? 'red' : 'yellow';
    const usedTokens = Math.round((percentUsed / 100) * maxTokens);
    const remainingPercent = Math.max(0, 100 - percentUsed);
    const barWidth = 20;
    const bar = buildBar(percentUsed, barWidth);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: color, bold: true, children: [isError ? '\u26A0 ' : '\u26A1 ', "Context usage: ", Math.round(percentUsed), "%"] }), _jsxs(Text, { dimColor: true, children: [' ', "(", formatTokens(usedTokens), " / ", formatTokens(maxTokens), " tokens)"] })] }), _jsxs(Box, { children: [_jsx(Text, { color: color, children: bar }), _jsxs(Text, { dimColor: true, children: [" ", remainingPercent, "% remaining"] })] }), isError && (_jsx(Box, { children: _jsx(Text, { color: "red", bold: true, children: "Context nearly full \u2014 consider running /compact" }) }))] }));
};
export default TokenWarning;
//# sourceMappingURL=TokenWarning.js.map