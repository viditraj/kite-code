/**
 * OutputStylePicker — Output verbosity selector.
 *
 * Three options (concise / normal / verbose) with descriptions.
 * Arrow keys + Enter to choose.
 */
import React from 'react';
export type OutputStyle = 'concise' | 'normal' | 'verbose';
export interface OutputStylePickerProps {
    /** Currently active output style. */
    current: OutputStyle;
    /** Called when the user selects a style. */
    onSelect: (style: OutputStyle) => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function OutputStylePicker({ current, onSelect, isActive, }: OutputStylePickerProps): React.ReactElement;
//# sourceMappingURL=OutputStylePicker.d.ts.map