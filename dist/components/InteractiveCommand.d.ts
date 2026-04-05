/**
 * InteractiveCommand — Renders interactive slash command UIs.
 *
 * Instead of dumping text for /help, /model, /provider, /theme, /mode,
 * these commands now show an arrow-key navigable selection list.
 * The user picks an option and the result is applied immediately.
 */
import React from 'react';
export interface CommandItem {
    label: string;
    value: string;
    hint?: string;
    color?: string;
    /** Extra data passed through on selection */
    meta?: Record<string, string>;
}
export interface InteractiveListProps {
    title: string;
    items: CommandItem[];
    onSelect: (item: CommandItem) => void;
    onCancel: () => void;
    isActive?: boolean;
}
export declare const InteractiveList: React.FC<InteractiveListProps>;
export declare function getHelpItems(): CommandItem[];
export declare function getModelItems(): CommandItem[];
export declare function getProviderItems(): CommandItem[];
export declare function getModeItems(): CommandItem[];
export declare function getThemeItems(): CommandItem[];
//# sourceMappingURL=InteractiveCommand.d.ts.map