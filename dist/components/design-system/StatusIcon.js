import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from 'ink';
const STATUS_CONFIG = {
    success: { icon: '\u2713', color: 'green' }, // ✓
    error: { icon: '\u2717', color: 'red' }, // ✗
    warning: { icon: '\u26A0', color: 'yellow' }, // ⚠
    info: { icon: '\u2139', color: 'blue' }, // ℹ
    pending: { icon: '\u25CB', color: undefined, dimColor: true }, // ○ (gray/dim)
    running: { icon: '\u27F3', color: 'cyan' }, // ⟳
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function StatusIcon({ status }) {
    const config = STATUS_CONFIG[status];
    return (_jsx(Text, { color: config.color, dimColor: config.dimColor ?? false, children: config.icon }));
}
export default StatusIcon;
//# sourceMappingURL=StatusIcon.js.map