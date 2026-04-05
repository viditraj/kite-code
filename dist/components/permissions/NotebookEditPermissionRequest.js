import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * NotebookEditPermissionRequest — Permission dialog for Jupyter notebook edits.
 *
 * Shows the notebook path, cell number, and edit mode with
 * allow/deny/always-allow choices.
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
const MODE_LABELS = {
    replace: 'Replace cell content',
    insert: 'Insert new cell',
    delete: 'Delete cell',
};
const MODE_COLORS = {
    replace: 'yellow',
    insert: 'green',
    delete: 'red',
};
// ============================================================================
// NotebookEditPermissionRequest Component
// ============================================================================
export const NotebookEditPermissionRequest = ({ notebookPath, cellNumber, editMode, onAllow, onDeny, onAllowAlways, isActive = true, }) => {
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
    const lastSlash = notebookPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? notebookPath.slice(0, lastSlash + 1) : '';
    const filename = lastSlash >= 0 ? notebookPath.slice(lastSlash + 1) : notebookPath;
    const modeLabel = MODE_LABELS[editMode] ?? editMode;
    const modeColor = MODE_COLORS[editMode] ?? 'white';
    // Render choices row
    const choiceRow = CHOICES.map((choice, idx) => {
        const sel = idx === selectedIdx;
        return (_jsx(Text, { color: sel ? choice.color : undefined, bold: sel, inverse: sel, children: ` ${choice.label} (${choice.hint}) ` }, choice.key));
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '\u26A1 ' }), _jsx(Text, { bold: true, children: "Notebook Edit" })] }), _jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { dimColor: true, children: dir }), _jsx(Text, { color: "cyan", bold: true, children: filename })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Cell:      " }), _jsxs(Text, { bold: true, children: ["#", cellNumber] })] }), _jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Operation: " }), _jsx(Text, { color: modeColor, bold: true, children: modeLabel })] })] }), _jsx(Box, { marginTop: 1, gap: 1, children: choiceRow }), _jsx(Text, { color: "yellow", children: '\u2500'.repeat(60) })] }));
};
export default NotebookEditPermissionRequest;
//# sourceMappingURL=NotebookEditPermissionRequest.js.map