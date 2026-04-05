/**
 * ThemePicker — Theme preview with live switching.
 *
 * Shows each theme with color preview samples (colored dots/blocks)
 * so the user can see what the theme looks like before selecting.
 * Arrow keys to navigate, Enter to select, Esc to cancel.
 */
import React from 'react';
export interface ThemePickerProps {
    /** Available theme names. */
    themes: string[];
    /** Currently active theme. */
    currentTheme: string;
    /** Called when the user selects a theme. */
    onSelect: (theme: string) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function ThemePicker({ themes, currentTheme, onSelect, onCancel, isActive, }: ThemePickerProps): React.ReactElement;
//# sourceMappingURL=ThemePicker.d.ts.map