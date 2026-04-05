/**
 * Pane — Bordered panel with title.
 *
 * A region of the terminal bounded by a border with a title text rendered
 * at the top. Used for containing related content in a visually grouped
 * section.
 *
 * @example
 * <Pane title="Settings" borderColor="primary">
 *   <Text>Content here</Text>
 * </Pane>
 *
 * @example
 * <Pane title="Output" width={60}>
 *   <Text>Some output</Text>
 * </Pane>
 */
import React from 'react';
export type PaneProps = {
    /** Title displayed at the top of the pane. */
    title: string;
    /** Pane body content. */
    children: React.ReactNode;
    /** Border colour — theme token or raw colour string. */
    borderColor?: string;
    /** Fixed width in characters. */
    width?: number;
};
export declare function Pane({ title, children, borderColor, width, }: PaneProps): React.ReactElement;
export default Pane;
//# sourceMappingURL=Pane.d.ts.map