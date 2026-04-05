/**
 * ListItem — Selectable list item for menus, dropdowns, and selection UIs.
 *
 * Renders an optional icon, a label, and optional hint text. Highlights when
 * selected or active.
 *
 * @example
 * <ListItem label="Option 1" isSelected />
 * <ListItem icon=">" label="Files" hint="3 items" isActive />
 * <ListItem label="Disabled" color="gray" />
 */
import React from 'react';
export type ListItemProps = {
    /** Optional icon rendered before the label. */
    icon?: string;
    /** Primary text for the item. */
    label: string;
    /** Secondary hint text rendered after the label, dimmed. */
    hint?: string;
    /** Whether this item is currently keyboard-selected (shows pointer). */
    isSelected?: boolean;
    /** Whether this item is the active/chosen item (highlighted). */
    isActive?: boolean;
    /** Override text colour — theme token or raw colour. */
    color?: string;
};
export declare function ListItem({ icon, label, hint, isSelected, isActive, color, }: ListItemProps): React.ReactElement;
export default ListItem;
//# sourceMappingURL=ListItem.d.ts.map