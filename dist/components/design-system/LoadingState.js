import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BLOCK = '\u2591'; // ░
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LoadingState({ lines = 3, width = 20, }) {
    const lineWidths = Array.from({ length: lines }, (_, i) => {
        // Vary line widths for a more natural skeleton look
        if (i === lines - 1) {
            return Math.max(4, Math.floor(width * 0.6));
        }
        if (i % 2 === 1) {
            return Math.max(4, Math.floor(width * 0.8));
        }
        return width;
    });
    return (_jsx(Box, { flexDirection: "column", children: lineWidths.map((w, i) => (_jsx(Text, { dimColor: true, children: BLOCK.repeat(w) }, i))) }));
}
export default LoadingState;
//# sourceMappingURL=LoadingState.js.map