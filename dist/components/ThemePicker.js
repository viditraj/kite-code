import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ThemePicker — Theme preview with live switching.
 *
 * Shows each theme with color preview samples (colored dots/blocks)
 * so the user can see what the theme looks like before selecting.
 * Arrow keys to navigate, Enter to select, Esc to cancel.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
const THEME_PALETTES = {
    default: { primary: 'cyan', secondary: 'green', accent: 'yellow', muted: 'gray' },
    dark: { primary: 'blue', secondary: 'magenta', accent: 'red', muted: 'gray' },
    light: { primary: 'cyan', secondary: 'green', accent: 'yellow', muted: 'white' },
    monokai: { primary: 'magenta', secondary: 'green', accent: 'yellow', muted: 'gray' },
    dracula: { primary: 'magenta', secondary: 'cyan', accent: 'green', muted: 'gray' },
    solarized: { primary: 'blue', secondary: 'cyan', accent: 'yellow', muted: 'green' },
    nord: { primary: 'blue', secondary: 'cyan', accent: 'white', muted: 'gray' },
    gruvbox: { primary: 'yellow', secondary: 'green', accent: 'red', muted: 'gray' },
};
function getPalette(theme) {
    return (THEME_PALETTES[theme.toLowerCase()] ?? {
        primary: 'cyan',
        secondary: 'green',
        accent: 'yellow',
        muted: 'gray',
    });
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ThemePicker({ themes, currentTheme, onSelect, onCancel, isActive = true, }) {
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const idx = themes.indexOf(currentTheme);
        return idx >= 0 ? idx : 0;
    });
    useInput((input, key) => {
        if (!isActive)
            return;
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.upArrow) {
            setSelectedIdx((prev) => (prev - 1 + themes.length) % themes.length);
            return;
        }
        if (key.downArrow) {
            setSelectedIdx((prev) => (prev + 1) % themes.length);
            return;
        }
        if (key.return) {
            const theme = themes[selectedIdx];
            if (theme)
                onSelect(theme);
            return;
        }
        // Number keys for quick select (1-9)
        const num = parseInt(input, 10);
        if (num >= 1 && num <= themes.length) {
            const theme = themes[num - 1];
            if (theme)
                onSelect(theme);
            return;
        }
    }, { isActive });
    // Currently previewed theme
    const previewTheme = themes[selectedIdx] ?? currentTheme;
    const palette = getPalette(previewTheme);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "Select Theme" }), _jsx(Text, { dimColor: true, children: '  (\u2191\u2193 navigate, Enter select, Esc cancel)' })] }), themes.map((theme, idx) => {
                const isSelected = idx === selectedIdx;
                const isCurrent = theme === currentTheme;
                const pal = getPalette(theme);
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '\u276F ' : '  ' }), _jsx(Text, { dimColor: true, children: `${idx + 1}. ` }), _jsx(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: theme }), isCurrent && _jsx(Text, { color: "green", children: ' (current)' }), _jsx(Text, { children: '  ' }), _jsx(Text, { color: pal.primary, children: '\u2588' }), _jsx(Text, { color: pal.secondary, children: '\u2588' }), _jsx(Text, { color: pal.accent, children: '\u2588' }), _jsx(Text, { color: pal.muted, children: '\u2588' })] }, theme));
            }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Preview: " }), _jsxs(Box, { children: [_jsx(Text, { color: palette.primary, children: '\u2588\u2588\u2588' }), _jsx(Text, { children: " " }), _jsx(Text, { color: palette.secondary, children: '\u2588\u2588\u2588' }), _jsx(Text, { children: " " }), _jsx(Text, { color: palette.accent, children: '\u2588\u2588\u2588' }), _jsx(Text, { children: " " }), _jsx(Text, { color: palette.muted, children: '\u2588\u2588\u2588' })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: palette.primary, children: "function " }), _jsx(Text, { color: palette.secondary, children: "greet" }), _jsx(Text, { color: palette.muted, children: '() { ' }), _jsx(Text, { color: palette.accent, children: "return " }), _jsx(Text, { color: palette.primary, children: "\"hello\"" }), _jsx(Text, { color: palette.muted, children: ' }' })] })] })] }));
}
//# sourceMappingURL=ThemePicker.js.map