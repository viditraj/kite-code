import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CodeBlock({ code, language, showLineNumbers = true, }) {
    const lines = code.split('\n');
    // Remove a trailing empty line that results from a trailing newline.
    if (lines.length > 1 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    const gutterWidth = showLineNumbers ? String(lines.length).length : 0;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [language && (_jsx(Box, { justifyContent: "flex-end", children: _jsx(Text, { color: "cyan", bold: true, children: language }) })), lines.map((line, idx) => {
                const lineNum = String(idx + 1).padStart(gutterWidth, ' ');
                return (_jsxs(Box, { children: [showLineNumbers && (_jsxs(Text, { dimColor: true, children: [lineNum, "  ", '│', ' '] })), _jsx(Text, { children: line })] }, idx));
            })] }));
}
//# sourceMappingURL=CodeBlock.js.map