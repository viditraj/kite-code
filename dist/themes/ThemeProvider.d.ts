/**
 * ThemeProvider — React context for the Kite colour theme.
 *
 * Wrap your app (or any subtree) in <ThemeProvider> to make the active theme
 * available to every descendant via the `useTheme()` hook.
 *
 * Usage:
 *   <ThemeProvider themeName="dark">
 *     <App />
 *   </ThemeProvider>
 *
 *   const [name, colors] = useTheme()
 */
import React from 'react';
import { themes, themeNames, type ThemeName, type ThemeTokens } from './themes.js';
export interface ThemeContextValue {
    /** Current theme name. */
    name: ThemeName;
    /** Resolved colour tokens for the current theme. */
    colors: ThemeTokens;
    /** Switch to a different theme at runtime. */
    setTheme: (name: ThemeName) => void;
}
export interface ThemeProviderProps {
    /** Initial theme name. Defaults to 'dark'. */
    themeName?: ThemeName;
    children: React.ReactNode;
}
export declare function ThemeProvider({ themeName, children, }: ThemeProviderProps): React.ReactElement;
/**
 * Access the current theme.
 *
 * @returns A tuple of `[themeName, themeColors]`.
 * @throws If called outside a `<ThemeProvider>`.
 */
export declare function useTheme(): [ThemeName, ThemeTokens];
/**
 * Access the full theme context (including `setTheme`).
 *
 * @throws If called outside a `<ThemeProvider>`.
 */
export declare function useThemeContext(): ThemeContextValue;
/**
 * Resolve a single token to its colour string for the given theme (or dark).
 *
 * Useful outside of React components where hooks are unavailable.
 */
export declare function getThemeColor(token: string, themeName?: ThemeName): string | undefined;
export { themes, themeNames, type ThemeName, type ThemeTokens };
//# sourceMappingURL=ThemeProvider.d.ts.map