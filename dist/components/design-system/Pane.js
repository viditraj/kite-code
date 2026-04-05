import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------
function resolveColor(color, colors) {
    if (!color)
        return undefined;
    if (color in colors) {
        return colors[color];
    }
    return color;
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Pane({ title, children, borderColor, width, }) {
    const [, colors] = useTheme();
    const resolvedBorder = resolveColor(borderColor, colors) ?? colors.border;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: resolvedBorder, width: width, paddingX: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: resolvedBorder, children: title }) }), _jsx(Box, { flexDirection: "column", children: children })] }));
}
export default Pane;
//# sourceMappingURL=Pane.js.map