import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BashPermissionRequest — Permission dialog for shell command execution.
 *
 * Shows the command in a code box with allow/deny/always-allow choices.
 * Highlights dangerous commands (rm, sudo, etc.) in red.
 * Uses y/n/a quick keys matching the PermissionRequest pattern.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const DANGEROUS_PATTERNS = [
    /\brm\s/,
    /\brm$/,
    /\bsudo\s/,
    /\bsudo$/,
    /\bchmod\s/,
    /\bchown\s/,
    /\bmkfs\b/,
    /\bdd\s/,
    /\b>\s*\/dev\//,
    /\bkill\s/,
    /\bkillall\s/,
    /\bshutdown\b/,
    /\breboot\b/,
    /\brm\s+-rf?\s/,
    /\bformat\b/,
];
function isDangerous(command) {
    return DANGEROUS_PATTERNS.some((p) => p.test(command));
}
const CHOICES = [
    { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
    { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
    { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
];
// ============================================================================
// BashPermissionRequest Component
// ============================================================================
export const BashPermissionRequest = ({ command, description, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const dangerous = isDangerous(command);
    useInput((inputStr, key) => {
        if (!isActive)
            return;
        if (key.leftArrow) {
            setSelectedIdx((prev) => (prev - 1 + CHOICES.length) % CHOICES.length);
            return;
        }
        if (key.rightArrow || key.tab) {
            setSelectedIdx((prev) => (prev + 1) % CHOICES.length);
            return;
        }
        if (key.return) {
            const choice = CHOICES[selectedIdx];
            if (choice.key === 'allow')
                onAllow();
            else if (choice.key === 'always')
                onAllowAlways();
            else
                onDeny();
            return;
        }
        if (inputStr === 'y' || inputStr === 'Y') {
            onAllow();
            return;
        }
        if (inputStr === 'a' || inputStr === 'A') {
            onAllowAlways();
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
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "Bash Command" }), description && (_jsxs(_Fragment, { children: [_jsx(Text, { dimColor: true, children: ' \u2014 ' }), _jsx(Text, { children: description })] }))] }), dangerous && (_jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { color: "red", bold: true, children: '\u26A0 Warning: ' }), _jsx(Text, { color: "red", children: "This command may be destructive" })] })), _jsx(Box, { marginLeft: 2, marginTop: 1, borderStyle: "round", borderColor: dangerous ? 'red' : 'gray', paddingX: 1, children: _jsxs(Text, { color: dangerous ? 'red' : 'white', bold: true, children: ['$ ', command] }) }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default BashPermissionRequest;
//# sourceMappingURL=BashPermissionRequest.js.map