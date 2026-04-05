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
import React from 'react';
export type DialogAction = {
    label: string;
    onSelect: () => void;
};
export type DialogProps = {
    /** Title displayed at the top of the dialog. */
    title: string;
    /** Dialog body content. */
    children: React.ReactNode;
    /** Action buttons displayed at the bottom. */
    actions?: DialogAction[];
    /** Whether the dialog is visible. */
    isOpen: boolean;
    /** Border colour — theme token or raw colour string. */
    borderColor?: string;
    /** Whether the dialog accepts keyboard input. Defaults to true when isOpen. */
    isActive?: boolean;
};
export declare function Dialog({ title, children, actions, isOpen, borderColor, isActive, }: DialogProps): React.ReactElement | null;
export default Dialog;
//# sourceMappingURL=Dialog.d.ts.map