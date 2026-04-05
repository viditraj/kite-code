import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FileEditPermissionRequest — Permission dialog for file edit operations.
 *
 * Shows an inline diff with red/green lines for removed/added content,
 * with allow/deny/always-allow choices.
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
// FileEditPermissionRequest Component
// ============================================================================
export const FileEditPermissionRequest = ({ filePath, oldString, newString, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
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
    // Extract filename from path
    const lastSlash = filePath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
    const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    // Build inline diff
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "Edit File" })] }), _jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { dimColor: true, children: dir }), _jsx(Text, { color: "cyan", bold: true, children: filename })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [oldLines.map((line, i) => (_jsx(Box, { children: _jsxs(Text, { color: "red", children: ['- ', line] }) }, `old-${i}`))), oldLines.length > 0 && newLines.length > 0 && (_jsx(Text, { dimColor: true, children: '\u2500'.repeat(40) })), newLines.map((line, i) => (_jsx(Box, { children: _jsxs(Text, { color: "green", children: ['+ ', line] }) }, `new-${i}`)))] }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default FileEditPermissionRequest;
//# sourceMappingURL=FileEditPermissionRequest.js.map