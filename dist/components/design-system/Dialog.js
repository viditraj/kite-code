import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Dialog — Modal dialog with title, content, and action buttons.
 *
 * Renders a bordered box with a title at the top, children content in the
 * middle, and optional action buttons at the bottom. Supports keyboard
 * navigation to cycle through and select actions.
 *
 * @example
 * <Dialog
 *   title="Confirm action"
 *   isOpen={true}
 *   actions={[
 *     { label: 'Yes', onSelect: handleYes },
 *     { label: 'No', onSelect: handleNo },
 *   ]}
 * >
 *   <Text>Are you sure you want to proceed?</Text>
 * </Dialog>
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../themes/ThemeProvider.js';
// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------
function resolveColor(color, colors) {
    if (!color)
        return undefined;
    if (color in colors) {
        return colors[color];
    }
    return color;
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Dialog({ title, children, actions = [], isOpen, borderColor, isActive, }) {
    const [, colors] = useTheme();
    const [focusedIndex, setFocusedIndex] = useState(0);
    const active = isActive ?? isOpen;
    useInput((input, key) => {
        if (!active || actions.length === 0)
            return;
        if (key.leftArrow || (key.shift && key.tab)) {
            setFocusedIndex((prev) => prev <= 0 ? actions.length - 1 : prev - 1);
            return;
        }
        if (key.rightArrow || key.tab) {
            setFocusedIndex((prev) => prev >= actions.length - 1 ? 0 : prev + 1);
            return;
        }
        if (key.return) {
            const action = actions[focusedIndex];
            if (action) {
                action.onSelect();
            }
            return;
        }
        if (key.escape) {
            // If there's a last action (conventionally "Cancel"), trigger it
            const cancelAction = actions[actions.length - 1];
            if (cancelAction) {
                cancelAction.onSelect();
            }
            return;
        }
    }, { isActive: active });
    if (!isOpen)
        return null;
    const resolvedBorder = resolveColor(borderColor, colors) ?? colors.border;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: resolvedBorder, paddingX: 1, paddingY: 0, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: resolvedBorder, children: title }) }), _jsx(Box, { flexDirection: "column", marginBottom: actions.length > 0 ? 1 : 0, children: children }), actions.length > 0 && (_jsx(Box, { flexDirection: "row", gap: 1, children: actions.map((action, i) => {
                    const isFocused = i === focusedIndex;
                    return (_jsx(Box, { children: _jsxs(Text, { inverse: isFocused, bold: isFocused, color: isFocused ? resolvedBorder : undefined, children: [' ', action.label, ' '] }) }, action.label));
                }) }))] }));
}
export default Dialog;
//# sourceMappingURL=Dialog.js.map