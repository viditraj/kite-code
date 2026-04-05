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
export function ListItem({ icon, label, hint, isSelected = false, isActive = false, color, }) {
    const [, colors] = useTheme();
    const resolvedColor = resolveColor(color, colors);
    // Determine indicator
    const indicator = isSelected ? '\u276F ' : '  '; // ❯ or spaces
    // Determine text colour based on state
    const textColor = resolvedColor
        ?? (isActive ? colors.success : isSelected ? colors.primary : undefined);
    const isBold = isSelected || isActive;
    return (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: isSelected ? colors.primary : undefined, children: indicator }), icon && (_jsxs(Text, { color: textColor, children: [icon, ' '] })), _jsx(Text, { color: textColor, bold: isBold, children: label }), hint && (_jsxs(Text, { dimColor: true, children: [' ', hint] }))] }));
}
export default ListItem;
//# sourceMappingURL=ListItem.js.map