/**
 * Divider — Horizontal or vertical separator line.
 *
 * Renders a line of repeated characters to visually separate regions.
 * Supports horizontal (default) and vertical orientations, with several
 * line styles: single, double, and dashed.
 *
 * @example
 * // Full-width single line
 * <Divider />
 *
 * // Coloured double line
 * <Divider style="double" color="primary" />
 *
 * // Fixed-width dashed
 * <Divider width={40} style="dashed" />
 *
 * // Vertical separator
 * <Divider direction="vertical" />
 */
import React from 'react';
export type DividerProps = {
    /** Orientation: 'horizontal' (default) or 'vertical'. */
    direction?: 'horizontal' | 'vertical';
    /**
     * Width in characters for horizontal, or height in rows for vertical.
     * Defaults to 40 for horizontal.
     */
    width?: number;
    /** Theme token or raw colour string. Uses dimColor if omitted. */
    color?: string;
    /** Line style. @default 'single' */
    style?: 'single' | 'double' | 'dashed';
    /** Optional title centred in the divider (horizontal only). */
    title?: string;
};
export declare function Divider({ direction, width, color, style, title, }: DividerProps): React.ReactElement;
export default Divider;
//# sourceMappingURL=Divider.d.ts.map