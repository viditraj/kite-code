import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTokens(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ContextVisualization({ usedTokens, maxTokens, inputTokens, outputTokens, }) {
    const barWidth = 40;
    const totalPercent = maxTokens > 0 ? clamp((usedTokens / maxTokens) * 100, 0, 100) : 0;
    // Calculate proportional widths for each segment
    const inputPercent = maxTokens > 0 ? (inputTokens / maxTokens) * 100 : 0;
    const outputPercent = maxTokens > 0 ? (outputTokens / maxTokens) * 100 : 0;
    const inputWidth = Math.round((inputPercent / 100) * barWidth);
    const outputWidth = Math.round((outputPercent / 100) * barWidth);
    const freeWidth = Math.max(0, barWidth - inputWidth - outputWidth);
    const inputBar = '\u2588'.repeat(inputWidth); // █ in cyan
    const outputBar = '\u2588'.repeat(outputWidth); // █ in green
    const freeBar = '\u2591'.repeat(freeWidth); // ░ dimmed
    const percentText = `${Math.round(totalPercent)}%`;
    // Determine color based on usage
    const usageColor = totalPercent >= 90 ? 'red' : totalPercent >= 70 ? 'yellow' : 'green';
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Context Usage" }), _jsxs(Text, { dimColor: true, children: ['  ', formatTokens(usedTokens), " / ", formatTokens(maxTokens), " tokens"] })] }), _jsxs(Box, { children: [_jsx(Text, { children: '[' }), _jsx(Text, { color: "cyan", children: inputBar }), _jsx(Text, { color: "green", children: outputBar }), _jsx(Text, { dimColor: true, children: freeBar }), _jsx(Text, { children: '] ' }), _jsx(Text, { color: usageColor, bold: true, children: percentText })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: '\u2588' }), _jsx(Text, { children: ' Input: ' }), _jsxs(Text, { dimColor: true, children: [formatTokens(inputTokens), " (", Math.round(inputPercent), "%)"] }), _jsx(Text, { children: '  ' }), _jsx(Text, { color: "green", children: '\u2588' }), _jsx(Text, { children: ' Output: ' }), _jsxs(Text, { dimColor: true, children: [formatTokens(outputTokens), " (", Math.round(outputPercent), "%)"] }), _jsx(Text, { children: '  ' }), _jsxs(Text, { dimColor: true, children: ['\u2591', ' Free: ', formatTokens(Math.max(0, maxTokens - usedTokens)), " (", Math.round(Math.max(0, 100 - totalPercent)), "%)"] })] })] }));
}
//# sourceMappingURL=ContextVisualization.js.map