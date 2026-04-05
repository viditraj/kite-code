import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BashModeProgress — Live-updating shell command progress display.
 *
 * Shows the command being executed, elapsed time, total bytes processed,
 * and a preview of the output in a bordered box.
 */
import { useState } from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '../Spinner/Spinner.js';
import { useInterval } from '../../ink/hooks/useInterval.js';
// ============================================================================
// Constants
// ============================================================================
const MAX_OUTPUT_LINES = 15;
const OUTPUT_UPDATE_INTERVAL = 500; // ms
// ============================================================================
// Helpers
// ============================================================================
function formatElapsed(seconds) {
    if (seconds < 60)
        return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${Math.floor(secs)}s`;
}
function formatBytes(bytes) {
    if (bytes >= 1_048_576)
        return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024)
        return `${(bytes / 1_024).toFixed(1)} KB`;
    return `${bytes} B`;
}
// ============================================================================
// BashModeProgress Component
// ============================================================================
export const BashModeProgress = ({ command, output, elapsed, totalBytes, }) => {
    // Force periodic re-renders to update the display
    const [, setTick] = useState(0);
    useInterval(() => {
        setTick((prev) => prev + 1);
    }, OUTPUT_UPDATE_INTERVAL);
    // Trim output to last N lines
    const outputLines = output.split('\n');
    const visibleLines = outputLines.slice(-MAX_OUTPUT_LINES);
    const hiddenLines = outputLines.length - visibleLines.length;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Spinner, { mode: "working" }), _jsx(Text, { children: " " }), _jsxs(Text, { color: "cyan", bold: true, children: ['$ ', command] })] }), _jsx(Box, { marginLeft: 2, children: _jsxs(Text, { dimColor: true, children: [formatElapsed(elapsed), " elapsed", ' \u2022 ', formatBytes(totalBytes), " output"] }) }), visibleLines.length > 0 && visibleLines.some((l) => l.trim()) && (_jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, children: [hiddenLines > 0 && (_jsxs(Text, { dimColor: true, children: ["... (", hiddenLines, " earlier line", hiddenLines !== 1 ? 's' : '', " hidden)"] })), visibleLines.map((line, i) => (_jsx(Text, { children: line }, i)))] }))] }));
};
export default BashModeProgress;
//# sourceMappingURL=BashModeProgress.js.map