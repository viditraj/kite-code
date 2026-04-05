/**
 * HelpV2 — Rich help screen with categorized commands.
 *
 * Groups commands by category, shows them as sections with headers.
 * Arrow keys to scroll, Esc to close.
 */
import React from 'react';
export interface HelpCommand {
    /** Command name (e.g. "/model"). */
    name: string;
    /** Human-readable description. */
    description: string;
    /** Category for grouping (e.g. "Navigation", "Settings"). */
    category: string;
    /** Optional aliases (e.g. ["/m"]). */
    aliases?: string[];
}
export interface HelpV2Props {
    /** Commands to display. */
    commands: HelpCommand[];
    /** Called when the user closes the help screen. */
    onClose: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function HelpV2({ commands, onClose, isActive, }: HelpV2Props): React.ReactElement;
//# sourceMappingURL=HelpV2.d.ts.map