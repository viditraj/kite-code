/**
 * Confirm — Yes / No confirmation dialog.
 *
 * Waits for the user to press 'y' or 'n' and fires the appropriate
 * callback.  Displays a message with a [Y/n] indicator.
 */
import React from 'react';
export interface ConfirmProps {
    /** The question / message to display. */
    message: string;
    /** Called when the user confirms (presses 'y' or 'Y'). */
    onConfirm: () => void;
    /** Called when the user cancels (presses 'n', 'N', or Escape). */
    onCancel: () => void;
    /** Whether this component is active for keyboard input. Defaults to true. */
    isActive?: boolean;
}
export declare function Confirm({ message, onConfirm, onCancel, isActive, }: ConfirmProps): React.ReactElement;
//# sourceMappingURL=Confirm.d.ts.map