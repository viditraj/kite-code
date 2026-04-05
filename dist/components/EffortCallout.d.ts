/**
 * EffortCallout — Effort level selector.
 *
 * Presents three effort levels (low, medium, high) with descriptions.
 * Arrow keys + Enter to choose, inspired by Claude Code's effort picker.
 */
import React from 'react';
export type EffortLevel = 'low' | 'medium' | 'high';
export interface EffortCalloutProps {
    /** Currently selected effort level. */
    current: EffortLevel;
    /** Called when the user selects a level. */
    onSelect: (level: EffortLevel) => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function EffortCallout({ current, onSelect, isActive, }: EffortCalloutProps): React.ReactElement;
//# sourceMappingURL=EffortCallout.d.ts.map