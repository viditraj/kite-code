import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Confirm — Yes / No confirmation dialog.
 *
 * Waits for the user to press 'y' or 'n' and fires the appropriate
 * callback.  Displays a message with a [Y/n] indicator.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Confirm({ message, onConfirm, onCancel, isActive = true, }) {
    const [answered, setAnswered] = useState(false);
    const [choice, setChoice] = useState(null);
    useInput((input, key) => {
        if (answered)
            return;
        if (input === 'y' || input === 'Y') {
            setAnswered(true);
            setChoice('yes');
            onConfirm();
            return;
        }
        if (input === 'n' || input === 'N' || key.escape) {
            setAnswered(true);
            setChoice('no');
            onCancel();
            return;
        }
    }, { isActive: isActive && !answered });
    return (_jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '? ' }), _jsxs(Text, { children: [message, " "] }), !answered ? (_jsx(Text, { dimColor: true, children: "[Y/n]" })) : choice === 'yes' ? (_jsx(Text, { color: "green", bold: true, children: "Yes" })) : (_jsx(Text, { color: "red", bold: true, children: "No" }))] }));
}
//# sourceMappingURL=Confirm.js.map