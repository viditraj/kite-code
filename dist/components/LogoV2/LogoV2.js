import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * LogoV2 — Welcome screen matching Claude Code's visual impact.
 *
 * Uses large block-letter text to render "KITE CODE" in massive characters,
 * similar to the first Claude Code welcome screen. Below the banner:
 * model info, CWD, tips — all clean and professional.
 *
 * Falls back gracefully if ink-big-text/cfonts is not available.
 */
import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../../ink/hooks/useTerminalSize.js';
// ============================================================================
// Block-letter fallback (used if ink-big-text can't load)
// ============================================================================
const KITE_BLOCK = [
    '\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D',
    '\u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2557  ',
    '\u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u255D  ',
    '\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
];
const CODE_BLOCK = [
    '   \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '   \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D',
    '   \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  ',
    '   \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  ',
    '   \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '    \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
];
// ============================================================================
// Try to load ink-big-text dynamically
// ============================================================================
let BigTextComponent = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ink-big-text');
    BigTextComponent = mod.default ?? mod;
}
catch {
    // ink-big-text not available — use fallback block letters
}
// ============================================================================
// Tips
// ============================================================================
const TIPS = [
    'Type /help for available commands',
    '/model to switch models mid-session',
    '/provider to switch LLM providers',
    '/compact to save context tokens',
    '/cost shows your session spending',
    'Use -p flag for non-interactive mode',
    'kite --setup to reconfigure providers',
    'kite --doctor to check your setup',
];
function truncatePath(p, max) {
    if (p.length <= max)
        return p;
    const parts = p.split('/');
    if (parts.length <= 3)
        return '\u2026' + p.slice(-(max - 1));
    return parts[0] + '/\u2026/' + parts.slice(-2).join('/');
}
// ============================================================================
// BlockBanner — renders KITE or CODE in block letters
// ============================================================================
const BlockBanner = ({ text, fallbackLines, color, font = 'block' }) => {
    if (BigTextComponent) {
        return (_jsx(Box, { children: _jsx(BigTextComponent, { text: text, font: font, colors: [color], space: false }) }));
    }
    // Fallback: pre-built block letters
    return (_jsx(Box, { flexDirection: "column", children: fallbackLines.map((line, i) => (_jsx(Text, { color: color, children: line }, i))) }));
};
// ============================================================================
// LogoV2 — Main Component
// ============================================================================
export const LogoV2 = ({ version = '0.1.0', model, provider, cwd, }) => {
    const { columns } = useTerminalSize();
    const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);
    const displayCwd = cwd ? truncatePath(cwd, 50) : undefined;
    if (columns < 40) {
        return _jsx(CondensedLogo, { version: version, model: model, provider: provider });
    }
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { borderStyle: "round", borderColor: "cyan", paddingX: 1, marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: '\u2731 ' }), _jsx(Text, { children: "Welcome to " }), _jsx(Text, { color: "cyan", bold: true, children: "Kite Code " }), _jsxs(Text, { dimColor: true, children: ["v", version] })] }), _jsx(BlockBanner, { text: "KITE", fallbackLines: KITE_BLOCK, color: "cyan" }), _jsx(BlockBanner, { text: "CODE", fallbackLines: CODE_BLOCK, color: "blue" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [model && (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: '  ' }), _jsx(Text, { bold: true, children: model }), provider && _jsx(Text, { dimColor: true, children: " via " }), provider && _jsx(Text, { color: "cyan", children: provider })] })), displayCwd && (_jsx(Box, { children: _jsxs(Text, { dimColor: true, children: ['  ', displayCwd] }) }))] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: '  \u25B8 ' }), _jsx(Text, { dimColor: true, children: tip })] })] }));
};
// ============================================================================
// CondensedLogo
// ============================================================================
export const CondensedLogo = ({ version = '0.1.0', model, provider, }) => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: _jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: '\u25C6 Kite Code' }), _jsxs(Text, { dimColor: true, children: [" v", version] }), model && _jsxs(Text, { dimColor: true, children: [" ", '\u00B7', " ", model] }), provider && _jsxs(Text, { dimColor: true, children: [" (", provider, ")"] })] }) }));
//# sourceMappingURL=LogoV2.js.map