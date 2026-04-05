import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FileWritePermissionRequest — Permission dialog for file write operations.
 *
 * Shows the file path and a preview of the first 10 lines of content
 * in a preview box, with allow/deny/always-allow choices.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const MAX_PREVIEW_LINES = 10;
const CHOICES = [
    { key: 'allow', label: 'Allow', hint: 'y', color: 'green' },
    { key: 'always', label: 'Always allow', hint: 'a', color: 'cyan' },
    { key: 'deny', label: 'Deny', hint: 'n', color: 'red' },
];
// ============================================================================
// FileWritePermissionRequest Component
// ============================================================================
export const FileWritePermissionRequest = ({ filePath, contentPreview, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
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
    // Prepare preview lines
    const lines = contentPreview.split('\n');
    const previewLines = lines.slice(0, MAX_PREVIEW_LINES);
    const hiddenCount = lines.length - previewLines.length;
    // Extract filename from path
    const lastSlash = filePath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
    const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "Write File" })] }), _jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { dimColor: true, children: dir }), _jsx(Text, { color: "cyan", bold: true, children: filename })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [previewLines.map((line, i) => (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [String(i + 1).padStart(3), " "] }), _jsx(Text, { children: line })] }, i))), hiddenCount > 0 && (_jsxs(Text, { dimColor: true, children: ["  ... (", hiddenCount, " more line", hiddenCount !== 1 ? 's' : '', ")"] }))] }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default FileWritePermissionRequest;
//# sourceMappingURL=FileWritePermissionRequest.js.map