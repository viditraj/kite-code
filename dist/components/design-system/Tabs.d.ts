/**
 * Tabs — Horizontal tab bar with keyboard navigation.
 *
 * Shows tabs in a horizontal row. The active tab is highlighted with inverse
 * styling. Use left/right arrow keys to navigate and the onSelect callback
 * fires when the active tab changes.
 *
 * @example
 * const [tab, setTab] = useState('general')
 * <Tabs
 *   tabs={[
 *     { label: 'General', value: 'general' },
 *     { label: 'Advanced', value: 'advanced' },
 *   ]}
 *   activeTab={tab}
 *   onSelect={setTab}
 * />
 */
import React from 'react';
export type TabDef = {
    label: string;
    value: string;
};
export type TabsProps = {
    /** Tab definitions. */
    tabs: TabDef[];
    /** Currently active tab value. */
    activeTab: string;
    /** Called when the user navigates to a new tab. */
    onSelect: (value: string) => void;
    /** Whether the tab bar accepts keyboard input. @default true */
    isActive?: boolean;
    /** Colour for the active tab — theme token or raw colour. */
    color?: string;
};
export declare function Tabs({ tabs, activeTab, onSelect, isActive, color, }: TabsProps): React.ReactElement;
export default Tabs;
//# sourceMappingURL=Tabs.d.ts.map