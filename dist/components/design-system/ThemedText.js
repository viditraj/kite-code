import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from 'ink';
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
export function ThemedText({ color, backgroundColor, children, ...rest }) {
    const [, colors] = useTheme();
    const resolvedColor = resolveColor(color, colors);
    const resolvedBg = resolveColor(backgroundColor, colors);
    return (_jsx(Text, { color: resolvedColor, backgroundColor: resolvedBg, ...rest, children: children }));
}
export default ThemedText;
//# sourceMappingURL=ThemedText.js.map