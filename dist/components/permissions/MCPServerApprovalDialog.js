import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MCPServerApprovalDialog — Approval dialog for MCP server connections.
 *
 * Shows server details (name, type) with approve/deny choices.
 * Uses y/n quick keys matching the PermissionRequest pattern.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const CHOICES = [
    { key: 'approve', label: 'Approve', hint: 'y', color: 'green' },
    { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
];
const TYPE_ICONS = {
    stdio: '\u2699', // ⚙
    sse: '\u21C4', // ⇄
    http: '\u2601', // ☁
};
// ============================================================================
// MCPServerApprovalDialog Component
// ============================================================================
export const MCPServerApprovalDialog = ({ serverName, serverType, onApprove, onDeny, isActive = true, }) => {
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
            if (choice.key === 'approve')
                onApprove();
            else
                onDeny();
            return;
        }
        if (inputStr === 'y' || inputStr === 'Y') {
            onApprove();
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
    const typeIcon = TYPE_ICONS[serverType] ?? '\u2699';
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "MCP Server Connection" })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Server: " }), _jsx(Text, { color: "cyan", bold: true, children: serverName })] }), _jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Type:   " }), _jsxs(Text, { children: [typeIcon, " ", serverType] })] })] }), _jsx(Box, { marginLeft: 2, marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Allow this MCP server to connect and provide tools?" }) }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default MCPServerApprovalDialog;
//# sourceMappingURL=MCPServerApprovalDialog.js.map