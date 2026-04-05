/**
 * FuzzyPicker — Fuzzy search dropdown with text input and filtered list.
 *
 * Features a text input at the top for typing a search query, and a filtered
 * list below. Uses simple substring matching for fuzzy filtering. Supports
 * keyboard navigation (arrow keys, Enter to select, Esc to cancel).
 *
 * @example
 * <FuzzyPicker
 *   items={[
 *     { label: 'File A', value: 'a' },
 *     { label: 'File B', value: 'b', hint: 'modified' },
 *   ]}
 *   onSelect={(item) => console.log('Selected', item.value)}
 *   onCancel={() => console.log('Cancelled')}
 *   placeholder="Search files..."
 * />
 */
import React from 'react';
export type FuzzyPickerItem = {
    label: string;
    value: string;
    hint?: string;
};
export type FuzzyPickerProps = {
    /** Items to display and filter. */
    items: FuzzyPickerItem[];
    /** Called when the user selects an item (Enter). */
    onSelect: (item: FuzzyPickerItem) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Placeholder text shown when the input is empty. */
    placeholder?: string;
    /** Whether the picker accepts keyboard input. @default true */
    isActive?: boolean;
    /** Maximum number of visible items in the list. @default 8 */
    visibleCount?: number;
    /** Colour for focused/active elements. */
    color?: string;
};
export declare function FuzzyPicker({ items, onSelect, onCancel, placeholder, isActive, visibleCount, color, }: FuzzyPickerProps): React.ReactElement;
export default FuzzyPicker;
//# sourceMappingURL=FuzzyPicker.d.ts.map