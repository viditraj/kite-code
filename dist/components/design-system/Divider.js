import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
// ---------------------------------------------------------------------------
// Character maps
// ---------------------------------------------------------------------------
const HORIZONTAL_CHARS = {
    single: '\u2500', // ─
    double: '\u2550', // ═
    dashed: '\u254C', // ╌
};
const VERTICAL_CHARS = {
    single: '\u2502', // │
    double: '\u2551', // ║
    dashed: '\u254E', // ╎
};
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
export function Divider({ direction = 'horizontal', width, color, style = 'single', title, }) {
    const [, colors] = useTheme();
    const resolvedColor = resolveColor(color, colors);
    const useDim = !color;
    if (direction === 'vertical') {
        const char = VERTICAL_CHARS[style] ?? VERTICAL_CHARS.single;
        const h = width ?? 1;
        return (_jsx(Box, { flexDirection: "column", children: Array.from({ length: h }, (_, i) => (_jsx(Text, { color: resolvedColor, dimColor: useDim, children: char }, i))) }));
    }
    // Horizontal
    const char = HORIZONTAL_CHARS[style] ?? HORIZONTAL_CHARS.single;
    const effectiveWidth = width ?? 40;
    if (title) {
        const titleWidth = title.length + 2; // " Title "
        const sideWidth = Math.max(0, effectiveWidth - titleWidth);
        const leftWidth = Math.floor(sideWidth / 2);
        const rightWidth = sideWidth - leftWidth;
        return (_jsxs(Text, { color: resolvedColor, dimColor: useDim, children: [char.repeat(leftWidth), ' ', _jsx(Text, { dimColor: true, children: title }), ' ', char.repeat(rightWidth)] }));
    }
    return (_jsx(Text, { color: resolvedColor, dimColor: useDim, children: char.repeat(effectiveWidth) }));
}
export default Divider;
//# sourceMappingURL=Divider.js.map