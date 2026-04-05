import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { formatTokenCount, getContextWindowForModel } from '../utils/format.js';
export const StatusBar = ({ model, provider, isLoading, messageCount, tokenCount, gitBranch, columns, }) => {
    const mode = isLoading
        ? { label: ' WORKING ', bg: 'yellow', fg: 'black' }
        : { label: ' READY ', bg: 'green', fg: 'black' };
    const sep = '\u2502';
    const ctxWindow = getContextWindowForModel(model);
    const pct = tokenCount > 0 ? Math.round((tokenCount / ctxWindow) * 100) : 0;
    const pctColor = pct > 80 ? 'red' : pct > 50 ? 'yellow' : undefined;
    return (_jsxs(Box, { children: [_jsx(Text, { backgroundColor: mode.bg, color: mode.fg, bold: true, children: mode.label }), _jsxs(Text, { dimColor: true, children: [" ", model] }), gitBranch && (_jsxs(_Fragment, { children: [_jsxs(Text, { dimColor: true, children: [" ", sep, " "] }), _jsx(Text, { color: "magenta", children: gitBranch })] })), _jsxs(Text, { dimColor: true, children: [" ", sep, " ", messageCount, " msg", messageCount !== 1 ? 's' : ''] }), tokenCount > 0 && (_jsxs(_Fragment, { children: [_jsxs(Text, { dimColor: true, children: [" ", sep, " "] }), _jsxs(Text, { color: pctColor, dimColor: !pctColor, children: [formatTokenCount(tokenCount), "/", formatTokenCount(ctxWindow), " (", pct, "%)"] })] })), _jsxs(Text, { dimColor: true, children: [" ", sep, " ", isLoading ? 'Ctrl+C cancel' : 'Ctrl+C exit'] })] }));
};
//# sourceMappingURL=StatusBar.js.map