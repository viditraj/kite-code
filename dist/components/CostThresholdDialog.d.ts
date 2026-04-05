/**
 * CostThresholdDialog — Budget alert dialog.
 *
 * Shows the current session cost vs the maximum budget, with a warning
 * and continue/stop buttons. Arrow keys + Enter to choose.
 */
import React from 'react';
export interface CostThresholdDialogProps {
    /** Current session cost in dollars. */
    currentCost: number;
    /** Maximum cost threshold in dollars. */
    maxCost: number;
    /** Called when the user chooses to continue. */
    onContinue: () => void;
    /** Called when the user chooses to stop. */
    onStop: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function CostThresholdDialog({ currentCost, maxCost, onContinue, onStop, isActive, }: CostThresholdDialogProps): React.ReactElement;
//# sourceMappingURL=CostThresholdDialog.d.ts.map