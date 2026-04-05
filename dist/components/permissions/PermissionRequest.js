import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PermissionRequest — permission prompt dialog for tool execution.
 *
 * Matches Claude Code's permission dialog pattern:
 * - Allow once / Always allow / Deny
 * - Quick keys: y/n/a
 * - Fixed-height layout to prevent border multiplication on re-render
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Choice definitions — fixed array, never changes
// ============================================================================
const CHOICES = [
    { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
    { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
    { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
];
// ============================================================================
// PermissionRequest Component
// ============================================================================
export const PermissionRequest = ({ toolName, description, message, input, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
    const [selectedIdx, setSelectedIdx] = useState(0);
    useInput((inputStr, key) => {
        if (!isActive)
            return;
        if (key.leftArrow) {
            setSelectedIdx(prev => (prev - 1 + CHOICES.length) % CHOICES.length);
            return;
        }
        if (key.rightArrow || key.tab) {
            setSelectedIdx(prev => (prev + 1) % CHOICES.length);
            return;
        }
        if (key.return) {
            const choice = CHOICES[selectedIdx];
            if (choice.key === 'allow')
                onAllow();
            else if (choice.key === 'always')
                (onAllowAlways ?? onAllow)();
            else
                onDeny();
            return;
        }
        if (inputStr === 'y' || inputStr === 'Y') {
            onAllow();
            return;
        }
        if (inputStr === 'a' || inputStr === 'A') {
            (onAllowAlways ?? onAllow)();
            return;
        }
        if (inputStr === 'n' || inputStr === 'N') {
            onDeny();
            return;
        }
        if (key.escape) {
            onDeny();
            return;
        }
    }, { isActive });
    // Preformat input summary (fixed, doesn't change)
    const inputSummary = (input && Object.keys(input).length > 0)
        ? Object.entries(input)
            .map(([k, v]) => {
            const val = typeof v === 'string'
                ? (v.length > 80 ? v.slice(0, 80) + '\u2026' : v)
                : JSON.stringify(v);
            return `${k}: ${val}`;
        })
            .join(', ')
        : null;
    // Render choices as a fixed-width row — no layout shift on selection change
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: toolName }), _jsx(Text, { dimColor: true, children: ' \u2014 ' }), _jsx(Text, { children: description })] }), inputSummary && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, children: inputSummary }) })), message && message !== description && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, italic: true, children: message }) })), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
//# sourceMappingURL=PermissionRequest.js.map