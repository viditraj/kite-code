/**
 * ThemedBox — A Box component that resolves theme token colors from context.
 *
 * Wraps Ink's Box with automatic theme colour resolution. Pass a ThemeToken
 * string (e.g. "primary", "border") for borderColor / backgroundColor and
 * the component will look up the actual colour from the active theme.
 *
 * @example
 * <ThemedBox borderColor="primary" borderStyle="round" padding={1}>
 *   <Text>Hello</Text>
 * </ThemedBox>
 */
import React from 'react';
import { type DOMElement } from 'ink';
type ThemeToken = string;
type ThemedColorProps = {
    readonly borderColor?: ThemeToken;
    readonly backgroundColor?: ThemeToken;
};
type BoxStyleProps = {
    readonly width?: number | string;
    readonly height?: number | string;
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly padding?: number;
    readonly paddingTop?: number;
    readonly paddingBottom?: number;
    readonly paddingLeft?: number;
    readonly paddingRight?: number;
    readonly paddingX?: number;
    readonly paddingY?: number;
    readonly margin?: number;
    readonly marginTop?: number;
    readonly marginBottom?: number;
    readonly marginLeft?: number;
    readonly marginRight?: number;
    readonly marginX?: number;
    readonly marginY?: number;
    readonly flexGrow?: number;
    readonly flexShrink?: number;
    readonly flexBasis?: number | string;
    readonly flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    readonly alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    readonly alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end';
    readonly justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
    readonly gap?: number;
    readonly columnGap?: number;
    readonly rowGap?: number;
    readonly display?: 'flex' | 'none';
    readonly overflowX?: 'visible' | 'hidden';
    readonly overflowY?: 'visible' | 'hidden';
    readonly overflow?: 'visible' | 'hidden';
    readonly borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
    readonly borderTop?: boolean;
    readonly borderBottom?: boolean;
    readonly borderLeft?: boolean;
    readonly borderRight?: boolean;
    readonly borderDimColor?: boolean;
};
export type ThemedBoxProps = BoxStyleProps & ThemedColorProps & {
    readonly children?: React.ReactNode;
    readonly ref?: React.Ref<DOMElement>;
};
export declare function ThemedBox({ borderColor, backgroundColor: _backgroundColor, children, ...rest }: ThemedBoxProps): React.ReactElement;
export default ThemedBox;
//# sourceMappingURL=ThemedBox.d.ts.map