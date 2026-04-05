import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CommandAutocomplete — dropdown suggestion list for slash commands.
 *
 * Adapted from Claude Code's PromptInputFooterSuggestions.tsx for Kite.
 * Renders a list of matching commands below the prompt input when the
 * user types '/'. Supports keyboard navigation (arrow keys, Tab, Enter).
 */
import { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { generateCommandSuggestions, getBestCommandMatch, findSlashCommandPrefix, } from '../utils/suggestions/commandSuggestions.js';
// ============================================================================
// Component
// ============================================================================
export const CommandAutocomplete = ({ inputValue, isActive, onSelect, onGhostTextChange, maxVisible = 10, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    // Detect slash command prefix
    const prefix = useMemo(() => findSlashCommandPrefix(inputValue), [inputValue]);
    // Generate suggestions
    const suggestions = useMemo(() => {
        if (prefix === null || dismissed)
            return [];
        return generateCommandSuggestions(prefix, maxVisible + 5);
    }, [prefix, dismissed, maxVisible]);
    // Ghost text for inline completion
    const ghostText = useMemo(() => {
        if (prefix === null || prefix.length === 0)
            return null;
        return getBestCommandMatch(prefix);
    }, [prefix]);
    // Notify parent of ghost text changes
    useEffect(() => {
        onGhostTextChange?.(ghostText);
    }, [ghostText, onGhostTextChange]);
    // Reset selection when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions.length, prefix]);
    // Reset dismissed when input changes
    useEffect(() => {
        setDismissed(false);
    }, [inputValue]);
    const isVisible = isActive && suggestions.length > 0 && prefix !== null && !dismissed;
    // Handle keyboard navigation
    useInput((input, key) => {
        if (!isVisible)
            return;
        if (key.downArrow) {
            setSelectedIndex(prev => prev < Math.min(suggestions.length, maxVisible) - 1 ? prev + 1 : 0);
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(prev => prev > 0 ? prev - 1 : Math.min(suggestions.length, maxVisible) - 1);
            return;
        }
        if (key.tab || key.return) {
            const selected = suggestions[selectedIndex];
            if (selected) {
                onSelect(`/${selected.name}`);
                setDismissed(true);
            }
            return;
        }
        if (key.escape) {
            setDismissed(true);
            return;
        }
    }, { isActive: isVisible });
    if (!isVisible)
        return null;
    const visibleSuggestions = suggestions.slice(0, maxVisible);
    return (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsx(Box, { marginBottom: 0, children: _jsx(Text, { dimColor: true, children: '─'.repeat(40) }) }), visibleSuggestions.map((suggestion, index) => (_jsx(SuggestionRow, { suggestion: suggestion, isSelected: index === selectedIndex }, suggestion.name))), suggestions.length > maxVisible && (_jsx(Box, { children: _jsxs(Text, { dimColor: true, children: ["  ... ", suggestions.length - maxVisible, " more"] }) }))] }));
};
// ============================================================================
// Suggestion Row
// ============================================================================
const SuggestionRow = ({ suggestion, isSelected }) => {
    const indicator = isSelected ? '>' : ' ';
    const nameColor = isSelected ? 'cyan' : 'white';
    return (_jsxs(Box, { children: [_jsxs(Text, { color: isSelected ? 'cyan' : undefined, children: [indicator, " "] }), _jsxs(Box, { width: 20, children: [_jsxs(Text, { color: nameColor, bold: isSelected, children: ["/", suggestion.name] }), suggestion.argumentHint && (_jsxs(Text, { dimColor: true, children: [" ", suggestion.argumentHint] }))] }), _jsxs(Text, { dimColor: true, children: [" ", suggestion.description] })] }));
};
// ============================================================================
// Hook
// ============================================================================
/**
 * Hook variant for non-Ink consumers (readline REPL).
 * Returns suggestion state without rendering.
 */
export function useCommandAutocomplete(inputValue, isActive) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const prefix = useMemo(() => findSlashCommandPrefix(inputValue), [inputValue]);
    const suggestions = useMemo(() => {
        if (prefix === null || dismissed)
            return [];
        return generateCommandSuggestions(prefix, 15);
    }, [prefix, dismissed]);
    const ghostText = useMemo(() => {
        if (prefix === null || prefix.length === 0)
            return null;
        return getBestCommandMatch(prefix);
    }, [prefix]);
    const isVisible = isActive && suggestions.length > 0 && prefix !== null && !dismissed;
    // Reset on input change
    useEffect(() => {
        setSelectedIndex(0);
        setDismissed(false);
    }, [inputValue]);
    return {
        suggestions,
        selectedIndex,
        isVisible,
        ghostText,
    };
}
//# sourceMappingURL=CommandAutocomplete.js.map