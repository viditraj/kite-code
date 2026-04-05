/**
 * ThinkingToggle — Simple toggle UI for thinking mode.
 *
 * Shows "Thinking: ON/OFF" with a visual toggle indicator.
 * Enter to toggle, renders inline.
 */
import React from 'react';
export interface ThinkingToggleProps {
    /** Whether thinking mode is currently enabled. */
    enabled: boolean;
    /** Called when the user toggles the state. */
    onToggle: () => void;
}
export declare function ThinkingToggle({ enabled, onToggle, }: ThinkingToggleProps): React.ReactElement;
//# sourceMappingURL=ThinkingToggle.d.ts.map