import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WebFetchPermissionRequest — Permission dialog for web fetch operations.
 *
 * Shows the URL being fetched with allow/deny/always-allow choices.
 * Extracts and displays the hostname prominently.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const CHOICES = [
    { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
    { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
    { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
];
// ============================================================================
// Helpers
// ============================================================================
function extractHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return url;
    }
}
// ============================================================================
// WebFetchPermissionRequest Component
// ============================================================================
export const WebFetchPermissionRequest = ({ url, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
    const [selectedIdx, setSelectedIdx] = useState(0);
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
    const hostname = extractHostname(url);
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "Fetch URL" })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Host: " }), _jsx(Text, { color: "cyan", bold: true, children: hostname })] }), _jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "URL:  " }), _jsx(Text, { children: url.length > 80 ? url.slice(0, 80) + '\u2026' : url })] })] }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default WebFetchPermissionRequest;
//# sourceMappingURL=WebFetchPermissionRequest.js.map