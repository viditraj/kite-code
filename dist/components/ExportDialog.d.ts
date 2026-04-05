/**
 * ExportDialog — Export conversation to file.
 *
 * Two-step dialog:
 *   1. Enter a filename (text input)
 *   2. Select a format (md / json / txt)
 * Enter to export, Esc to cancel.
 */
import React from 'react';
export type ExportFormat = 'md' | 'json' | 'txt';
export interface ExportDialogProps {
    /** Default filename (without extension). */
    defaultFilename: string;
    /** Called when the user exports. */
    onExport: (filename: string, format: ExportFormat) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function ExportDialog({ defaultFilename, onExport, onCancel, isActive, }: ExportDialogProps): React.ReactElement;
//# sourceMappingURL=ExportDialog.d.ts.map