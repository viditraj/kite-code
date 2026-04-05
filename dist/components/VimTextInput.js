import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * VimTextInput — Full vim-mode text input component.
 *
 * Uses the useVimMode hook from /root/kite-ts/src/ink/hooks/useVimMode.ts
 * to provide vim-style editing with mode indicator below the input.
 * Shows "-- INSERT --" / "-- NORMAL --" / "-- VISUAL --" status.
 */
import { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useVimMode } from '../ink/hooks/useVimMode.js';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VimTextInput({ value, onChange, onSubmit, isActive = true, placeholder, }) {
    const vim = useVimMode({
        initialValue: value,
        isActive,
        onSubmit,
    });
    // Sync external value → vim state
    useEffect(() => {
        if (vim.value !== value) {
            vim.setValue(value);
        }
    }, [value]);
    // Sync vim state → external onChange
    useEffect(() => {
        if (vim.value !== value) {
            onChange(vim.value);
        }
    }, [vim.value]);
    const text = vim.value;
    const cursor = vim.cursorPos;
    const mode = vim.mode;
    // Render text with visible cursor
    const isEmpty = text.length === 0;
    const before = text.slice(0, cursor);
    const atCursor = cursor < text.length ? text[cursor] : undefined;
    const after = cursor < text.length ? text.slice(cursor + 1) : '';
    // Mode indicator colours
    const modeColor = mode === 'insert'
        ? 'green'
        : mode === 'visual'
            ? 'magenta'
            : 'blue';
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "> " }), isEmpty && placeholder ? (_jsx(Text, { dimColor: true, children: placeholder })) : (_jsxs(Box, { children: [_jsx(Text, { children: before }), isActive ? (_jsx(Text, { inverse: mode !== 'insert', underline: mode === 'insert', color: mode === 'insert' ? undefined : modeColor, children: atCursor ?? ' ' })) : (_jsx(Text, { children: atCursor ?? '' })), _jsx(Text, { children: after })] }))] }), isActive && (_jsx(Box, { children: _jsx(Text, { color: modeColor, bold: true, children: vim.statusLine }) }))] }));
}
//# sourceMappingURL=VimTextInput.js.map