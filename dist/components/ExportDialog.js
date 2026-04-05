import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ExportDialog — Export conversation to file.
 *
 * Two-step dialog:
 *   1. Enter a filename (text input)
 *   2. Select a format (md / json / txt)
 * Enter to export, Esc to cancel.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
const FORMATS = [
    { format: 'md', label: 'Markdown', description: '.md — Rich formatting with headers and code blocks' },
    { format: 'json', label: 'JSON', description: '.json — Structured data, machine-readable' },
    { format: 'txt', label: 'Plain Text', description: '.txt — Simple plain text' },
];
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ExportDialog({ defaultFilename, onExport, onCancel, isActive = true, }) {
    const [filename, setFilename] = useState(defaultFilename);
    const [cursorPos, setCursorPos] = useState(defaultFilename.length);
    const [step, setStep] = useState('filename');
    const [formatIdx, setFormatIdx] = useState(0);
    useInput((input, key) => {
        if (!isActive)
            return;
        // Escape — cancel or go back
        if (key.escape) {
            if (step === 'format') {
                setStep('filename');
                return;
            }
            onCancel();
            return;
        }
        // ---- Step 1: Filename input ----
        if (step === 'filename') {
            if (key.return) {
                if (filename.trim().length > 0) {
                    setStep('format');
                }
                return;
            }
            if (key.backspace || key.delete) {
                if (cursorPos > 0) {
                    setFilename((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
                    setCursorPos((prev) => prev - 1);
                }
                return;
            }
            if (key.leftArrow) {
                setCursorPos((prev) => Math.max(0, prev - 1));
                return;
            }
            if (key.rightArrow) {
                setCursorPos((prev) => Math.min(filename.length, prev + 1));
                return;
            }
            // Ctrl+U — clear
            if (key.ctrl && input === 'u') {
                setFilename('');
                setCursorPos(0);
                return;
            }
            // Regular character input
            if (input && !key.ctrl && !key.meta) {
                setFilename((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
                setCursorPos((prev) => prev + input.length);
            }
            return;
        }
        // ---- Step 2: Format selection ----
        if (step === 'format') {
            if (key.upArrow) {
                setFormatIdx((prev) => (prev - 1 + FORMATS.length) % FORMATS.length);
                return;
            }
            if (key.downArrow) {
                setFormatIdx((prev) => (prev + 1) % FORMATS.length);
                return;
            }
            if (key.return) {
                const fmt = FORMATS[formatIdx];
                if (fmt) {
                    const fullName = filename.includes('.')
                        ? filename
                        : `${filename}.${fmt.format}`;
                    onExport(fullName, fmt.format);
                }
                return;
            }
            // Number keys for quick select
            const num = parseInt(input, 10);
            if (num >= 1 && num <= FORMATS.length) {
                const fmt = FORMATS[num - 1];
                if (fmt) {
                    const fullName = filename.includes('.')
                        ? filename
                        : `${filename}.${fmt.format}`;
                    onExport(fullName, fmt.format);
                }
                return;
            }
        }
    }, { isActive });
    // Render the filename with cursor
    const before = filename.slice(0, cursorPos);
    const atCursor = cursorPos < filename.length ? filename[cursorPos] : undefined;
    const after = cursorPos < filename.length ? filename.slice(cursorPos + 1) : '';
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Export Conversation" }), _jsx(Text, { dimColor: true, children: '  (Esc to cancel)' })] }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Text, { bold: true, children: [step === 'filename' ? '\u276F ' : '\u2713 ', "Filename:"] }), _jsx(Box, { marginLeft: 2, children: step === 'filename' ? (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "> " }), _jsx(Text, { children: before }), _jsx(Text, { inverse: true, children: atCursor ?? ' ' }), _jsx(Text, { children: after })] })) : (_jsx(Text, { dimColor: true, children: filename })) })] }), step === 'format' && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, children: '\u276F Format:' }), _jsx(Text, { dimColor: true, children: '  (\u2191\u2193 navigate, Enter select)' })] }), FORMATS.map((fmt, idx) => {
                        const isSelected = idx === formatIdx;
                        return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '  \u276F ' : '    ' }), _jsx(Text, { dimColor: true, children: `${idx + 1}. ` }), _jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: fmt.label }), _jsx(Text, { dimColor: true, children: `  ${fmt.description}` })] }, fmt.format));
                    })] })), step === 'filename' && (_jsx(Text, { dimColor: true, children: 'Press Enter to choose format' }))] }));
}
//# sourceMappingURL=ExportDialog.js.map