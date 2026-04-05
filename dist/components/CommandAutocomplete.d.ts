/**
 * CommandAutocomplete — dropdown suggestion list for slash commands.
 *
 * Adapted from Claude Code's PromptInputFooterSuggestions.tsx for Kite.
 * Renders a list of matching commands below the prompt input when the
 * user types '/'. Supports keyboard navigation (arrow keys, Tab, Enter).
 */
import React from 'react';
import { type CommandSuggestion } from '../utils/suggestions/commandSuggestions.js';
export interface CommandAutocompleteProps {
    /** Current input value */
    inputValue: string;
    /** Whether the autocomplete is active */
    isActive: boolean;
    /** Callback when a suggestion is selected */
    onSelect: (command: string) => void;
    /** Callback when suggestions change (for ghost text) */
    onGhostTextChange?: (ghostText: string | null) => void;
    /** Maximum visible suggestions */
    maxVisible?: number;
}
export interface CommandAutocompleteResult {
    /** Current suggestions list */
    suggestions: CommandSuggestion[];
    /** Index of the currently selected suggestion */
    selectedIndex: number;
    /** Whether the autocomplete dropdown is visible */
    isVisible: boolean;
    /** Ghost text for inline completion */
    ghostText: string | null;
}
export declare const CommandAutocomplete: React.FC<CommandAutocompleteProps>;
/**
 * Hook variant for non-Ink consumers (readline REPL).
 * Returns suggestion state without rendering.
 */
export declare function useCommandAutocomplete(inputValue: string, isActive: boolean): CommandAutocompleteResult;
//# sourceMappingURL=CommandAutocomplete.d.ts.map