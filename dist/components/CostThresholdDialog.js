import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * CostThresholdDialog — Budget alert dialog.
 *
 * Shows the current session cost vs the maximum budget, with a warning
 * and continue/stop buttons. Arrow keys + Enter to choose.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CostThresholdDialog({ currentCost, maxCost, onContinue, onStop, isActive = true, }) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const options = [
        { label: 'Continue', action: onContinue, color: 'green' },
        { label: 'Stop', action: onStop, color: 'red' },
    ];
    useInput((input, key) => {
        if (!isActive)
            return;
        if (key.escape) {
            onStop();
            return;
        }
        if (key.upArrow || key.leftArrow) {
            setSelectedIdx((prev) => (prev - 1 + options.length) % options.length);
            return;
        }
        if (key.downArrow || key.rightArrow) {
            setSelectedIdx((prev) => (prev + 1) % options.length);
            return;
        }
        if (key.return) {
            const opt = options[selectedIdx];
            if (opt)
                opt.action();
            return;
        }
        // 'c' for continue, 's' for stop
        if (input === 'c') {
            onContinue();
            return;
        }
        if (input === 's') {
            onStop();
            return;
        }
    }, { isActive });
    const costPercent = maxCost > 0 ? (currentCost / maxCost) * 100 : 0;
    const barWidth = 30;
    const filledWidth = Math.round((Math.min(costPercent, 100) / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const barColor = costPercent >= 100 ? 'red' : costPercent >= 80 ? 'yellow' : 'green';
    const filled = '\u2588'.repeat(filledWidth);
    const empty = '\u2591'.repeat(emptyWidth);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, borderStyle: "single", borderColor: "yellow", paddingX: 1, children: _jsxs(Text, { color: "yellow", bold: true, children: ['\u26A0', " Budget Alert"] }) }), _jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { children: "Session cost: " }), _jsxs(Text, { color: barColor, bold: true, children: ["$", currentCost.toFixed(2)] }), _jsx(Text, { children: " / " }), _jsxs(Text, { bold: true, children: ["$", maxCost.toFixed(2)] })] }), _jsxs(Box, { children: [_jsx(Text, { children: '[' }), _jsx(Text, { color: barColor, children: filled }), _jsx(Text, { dimColor: true, children: empty }), _jsx(Text, { children: '] ' }), _jsxs(Text, { color: barColor, children: [Math.round(costPercent), "%"] })] })] }), costPercent >= 100 ? (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "red", bold: true, children: "You have exceeded your session budget!" }) })) : (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "yellow", children: "You are approaching your session budget limit." }) })), _jsx(Box, { marginBottom: 1, children: _jsx(Text, { dimColor: true, children: '(\u2191\u2193 navigate, Enter select, c=continue, s=stop)' }) }), options.map((opt, idx) => {
                const isSelected = idx === selectedIdx;
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsx(Text, { color: opt.color, bold: isSelected, children: opt.label })] }, opt.label));
            })] }));
}
//# sourceMappingURL=CostThresholdDialog.js.map