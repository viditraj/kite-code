/**
 * HistorySearchDialog — Search conversation messages.
 *
 * Text input for search query, filtered list of matching messages below.
 * Arrow keys to navigate results, Enter to select, Esc to cancel.
 */
import React from 'react';
export interface HistoryMessage {
    role: string;
    content: string;
}
export interface HistorySearchDialogProps {
    /** All messages to search through. */
    messages: HistoryMessage[];
    /** Called when the user selects a message by index. */
    onSelect: (index: number) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function HistorySearchDialog({ messages, onSelect, onCancel, isActive, }: HistorySearchDialogProps): React.ReactElement;
//# sourceMappingURL=HistorySearchDialog.d.ts.map