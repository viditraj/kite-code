/**
 * KeyboardShortcutHint — Renders a keyboard shortcut with styled key badges.
 *
 * Shows each key in an inverse-coloured badge followed by an optional label.
 * Commonly used in status bars and help text.
 *
 * @example
 * // Single key with label
 * <KeyboardShortcutHint keys={['Enter']} label="confirm" />
 * // Renders: [Enter] confirm
 *
 * // Combo
 * <KeyboardShortcutHint keys={['Ctrl', 'C']} label="cancel" />
 * // Renders: [Ctrl] [C] cancel
 *
 * // Keys only
 * <KeyboardShortcutHint keys={['Esc']} />
 */
import React from 'react';
export type KeyboardShortcutHintProps = {
    /** Keys to display as badges, e.g. ['Ctrl', 'C']. */
    keys: string[];
    /** Optional label shown after the key badges. */
    label?: string;
};
export declare function KeyboardShortcutHint({ keys, label, }: KeyboardShortcutHintProps): React.ReactElement;
export default KeyboardShortcutHint;
//# sourceMappingURL=KeyboardShortcutHint.d.ts.map