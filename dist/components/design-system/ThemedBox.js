import { jsx as _jsx } from "react/jsx-runtime";
import { Box } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------
/**
 * Resolves a colour value that may be a theme token to a concrete colour string.
 */
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
export function ThemedBox({ borderColor, backgroundColor: _backgroundColor, children, ...rest }) {
    const [, colors] = useTheme();
    const resolvedBorderColor = resolveColor(borderColor, colors);
    return (_jsx(Box, { borderColor: resolvedBorderColor, ...rest, children: children }));
}
export default ThemedBox;
//# sourceMappingURL=ThemedBox.js.map