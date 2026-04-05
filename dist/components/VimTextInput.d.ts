/**
 * VimTextInput — Full vim-mode text input component.
 *
 * Uses the useVimMode hook from /root/kite-ts/src/ink/hooks/useVimMode.ts
 * to provide vim-style editing with mode indicator below the input.
 * Shows "-- INSERT --" / "-- NORMAL --" / "-- VISUAL --" status.
 */
import React from 'react';
export interface VimTextInputProps {
    /** Current text value. */
    value: string;
    /** Called when the text value changes. */
    onChange: (value: string) => void;
    /** Called when the user submits (Enter in insert mode). */
    onSubmit: (value: string) => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
    /** Placeholder text shown when value is empty. */
    placeholder?: string;
}
export declare function VimTextInput({ value, onChange, onSubmit, isActive, placeholder, }: VimTextInputProps): React.ReactElement;
//# sourceMappingURL=VimTextInput.d.ts.map