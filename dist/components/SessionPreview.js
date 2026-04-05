import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 1) + '\u2026';
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SessionPreview({ sessionId, date, messageCount, firstMessage, model, }) {
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", bold: true, children: ['\u25CF', " Session"] }), _jsxs(Text, { dimColor: true, children: [' #', sessionId.slice(0, 8)] }), _jsx(Text, { children: '  ' }), _jsx(Text, { dimColor: true, children: date })] }), _jsxs(Box, { children: [_jsxs(Text, { children: ['\u2514', " ", messageCount, " message", messageCount !== 1 ? 's' : ''] }), model && (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: ' \u00B7 ' }), _jsx(Text, { color: "magenta", children: model })] }))] }), firstMessage && (_jsx(Box, { marginTop: 0, children: _jsxs(Text, { dimColor: true, children: ['  \u201C', truncate(firstMessage.replace(/\n/g, ' '), 60), '\u201D'] }) }))] }));
}
//# sourceMappingURL=SessionPreview.js.map