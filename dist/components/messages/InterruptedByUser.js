import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// InterruptedByUser Component
// ============================================================================
export const InterruptedByUser = ({ reason }) => {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { children: _jsx(Text, { color: "yellow", bold: true, children: '\u26A1 Request cancelled' }) }), reason && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "yellow", dimColor: true, children: reason }) }))] }));
};
export default InterruptedByUser;
//# sourceMappingURL=InterruptedByUser.js.map