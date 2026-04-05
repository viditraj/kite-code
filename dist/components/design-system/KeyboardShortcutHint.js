import { jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function KeyboardShortcutHint({ keys, label, }) {
    return (_jsxs(Box, { flexDirection: "row", gap: 0, children: [keys.map((key, i) => (_jsxs(Text, { children: [_jsxs(Text, { inverse: true, bold: true, children: [' ', key, ' '] }), i < keys.length - 1 ? ' ' : ''] }, `${key}-${i}`))), label && (_jsxs(Text, { dimColor: true, children: [' ', label] }))] }));
}
export default KeyboardShortcutHint;
//# sourceMappingURL=KeyboardShortcutHint.js.map