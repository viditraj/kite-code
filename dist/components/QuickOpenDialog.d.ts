/**
 * QuickOpenDialog — File picker with fuzzy filtering.
 *
 * Runs `find` to list files in the cwd, shows a fuzzy-filtered list.
 * Type to filter, arrow keys to navigate, Enter to select, Esc to cancel.
 * Limits to 20 visible items.
 */
import React from 'react';
export interface QuickOpenDialogProps {
    /** Current working directory to search in. */
    cwd: string;
    /** Called when the user selects a file path. */
    onSelect: (path: string) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function QuickOpenDialog({ cwd, onSelect, onCancel, isActive, }: QuickOpenDialogProps): React.ReactElement;
//# sourceMappingURL=QuickOpenDialog.d.ts.map