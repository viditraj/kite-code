import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { Spinner } from '../Spinner/Spinner.js';
// ============================================================================
// ToolUseLoader Component
// ============================================================================
export const ToolUseLoader = ({ toolName, description, }) => {
    return (_jsxs(Box, { children: [_jsx(Spinner, { mode: "working" }), _jsx(Text, { children: " " }), _jsx(Text, { color: "cyan", bold: true, children: toolName }), description && (_jsxs(Text, { dimColor: true, children: [' \u2014 ', description] }))] }));
};
export default ToolUseLoader;
//# sourceMappingURL=ToolUseLoader.js.map