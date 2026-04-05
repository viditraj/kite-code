import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { MarkdownText } from '../MarkdownText.js';
import { getColor } from '../../themes/activeTheme.js';
import { MessageTimestamp } from './MessageTimestamp.js';
// ============================================================================
// Constants
// ============================================================================
const MAX_TOOL_CONTENT = 500;
function truncate(s, max) {
    return s.length <= max ? s : s.slice(0, max) + '... (truncated)';
}
// ============================================================================
// Tool result formatters — type-specific display
// ============================================================================
function isFileWriteResult(content) {
    try {
        const d = JSON.parse(content);
        if (d.filePath && d.bytesWritten !== undefined)
            return { path: d.filePath, bytes: d.bytesWritten };
    }
    catch { }
    return null;
}
function isFileEditResult(content) {
    try {
        const d = JSON.parse(content);
        if (d.filePath && d.replacements !== undefined)
            return { path: d.filePath, count: d.replacements };
    }
    catch { }
    return null;
}
function isBashResult(content) {
    try {
        const d = JSON.parse(content);
        if (d.stdout !== undefined && d.exitCode !== undefined)
            return { stdout: d.stdout, exitCode: d.exitCode, duration: d.durationMs };
    }
    catch { }
    return null;
}
// ============================================================================
// User Message
// ============================================================================
export const UserMessage = ({ content, timestamp }) => (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: getColor('success'), bold: true, children: '\u276F ' }), _jsx(Text, { color: getColor('success'), bold: true, children: "You" }), timestamp != null && (_jsxs(_Fragment, { children: [_jsx(Text, { dimColor: true, children: " " }), _jsx(MessageTimestamp, { timestamp: timestamp })] }))] }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { children: content }) })] }));
// ============================================================================
// Assistant Message — with markdown rendering
// ============================================================================
export const AssistantMessage = ({ content, isThinking, timestamp }) => {
    if (isThinking) {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "magenta", dimColor: true, children: '\u25C7 ' }), _jsx(Text, { dimColor: true, italic: true, children: "thinking..." })] }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, italic: true, children: content }) })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: getColor('kite_brand'), bold: true, children: '\u25C6 Kite' }), timestamp != null && (_jsxs(_Fragment, { children: [_jsx(Text, { dimColor: true, children: " " }), _jsx(MessageTimestamp, { timestamp: timestamp })] }))] }), _jsx(Box, { marginLeft: 2, children: _jsx(MarkdownText, { children: content }) })] }));
};
// ============================================================================
// System Message
// ============================================================================
export const SystemMessage = ({ content }) => (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: getColor('warning'), bold: true, children: '\u2699 ' }), _jsx(Text, { color: getColor('warning'), bold: true, children: "System" })] }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: getColor('warning'), children: content }) })] }));
// ============================================================================
// Tool Result Message — with type-specific formatting
// ============================================================================
export const ToolResultMessage = ({ toolName, content, isError }) => {
    // Try type-specific rendering
    const writeResult = isFileWriteResult(content);
    if (writeResult && !isError) {
        return (_jsxs(Box, { children: [_jsx(Text, { color: getColor('primary'), bold: true, children: '\u2B21 ' }), _jsx(Text, { color: getColor('primary'), bold: true, children: toolName }), _jsx(Text, { color: "green", children: ' + ' }), _jsx(Text, { children: writeResult.path }), _jsxs(Text, { dimColor: true, children: [" (", writeResult.bytes, " bytes)"] })] }));
    }
    const editResult = isFileEditResult(content);
    if (editResult && !isError) {
        return (_jsxs(Box, { children: [_jsx(Text, { color: getColor('primary'), bold: true, children: '\u2B21 ' }), _jsx(Text, { color: getColor('primary'), bold: true, children: toolName }), _jsx(Text, { color: "yellow", children: ' ~ ' }), _jsx(Text, { children: editResult.path }), _jsxs(Text, { dimColor: true, children: [" (", editResult.count, " replacement", editResult.count !== 1 ? 's' : '', ")"] })] }));
    }
    const bashResult = isBashResult(content);
    if (bashResult && !isError) {
        const duration = bashResult.duration ? ` [${(bashResult.duration / 1000).toFixed(1)}s]` : '';
        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: getColor('primary'), bold: true, children: '\u2B21 ' }), _jsx(Text, { color: getColor('primary'), bold: true, children: toolName }), bashResult.exitCode !== 0 && _jsxs(Text, { color: "red", children: [" (exit ", bashResult.exitCode, ")"] }), _jsx(Text, { dimColor: true, children: duration })] }), bashResult.stdout.trim() && (_jsx(Box, { marginLeft: 2, borderStyle: "single", borderColor: "gray", paddingX: 1, children: _jsx(Text, { children: truncate(bashResult.stdout.trim(), MAX_TOOL_CONTENT) }) }))] }));
    }
    // Generic tool result
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: getColor('primary'), bold: true, children: '\u2B21 ' }), _jsx(Text, { color: getColor('primary'), bold: true, children: toolName }), isError && _jsx(Text, { color: "red", bold: true, children: ' (error)' })] }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: isError ? 'red' : 'gray', children: truncate(content, MAX_TOOL_CONTENT) }) })] }));
};
// ============================================================================
// MessageRow — dispatches to the right component
// ============================================================================
export const MessageRow = ({ message }) => {
    const { role, content, toolName, isError, isThinking, timestamp } = message;
    switch (role) {
        case 'user':
            return _jsx(UserMessage, { content: content, timestamp: timestamp });
        case 'assistant':
            return _jsx(AssistantMessage, { content: content, isThinking: isThinking, timestamp: timestamp });
        case 'system':
            return _jsx(SystemMessage, { content: content });
        case 'tool_result':
            return _jsx(ToolResultMessage, { toolName: toolName ?? 'tool', content: content, isError: isError });
        default:
            return _jsx(Text, { children: content });
    }
};
// ============================================================================
// MessageDivider
// ============================================================================
export const MessageDivider = ({ width = 60 }) => (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: '\u2500'.repeat(Math.min(width, 60)) }) }));
//# sourceMappingURL=MessageRow.js.map