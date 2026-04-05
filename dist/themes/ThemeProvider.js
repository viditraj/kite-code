import { jsx as _jsx } from "react/jsx-runtime";
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
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { themes, themeNames } from './themes.js';
const ThemeContext = createContext(null);
export function ThemeProvider({ themeName = 'dark', children, }) {
    const [currentName, setCurrentName] = useState(themeName);
    const setTheme = useCallback((name) => {
        if (themes[name]) {
            setCurrentName(name);
        }
    }, []);
    const value = useMemo(() => ({
        name: currentName,
        colors: themes[currentName],
        setTheme,
    }), [currentName, setTheme]);
    return (_jsx(ThemeContext.Provider, { value: value, children: children }));
}
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
/**
 * Access the current theme.
 *
 * @returns A tuple of `[themeName, themeColors]`.
 * @throws If called outside a `<ThemeProvider>`.
 */
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme() must be used inside a <ThemeProvider>');
    }
    return [ctx.name, ctx.colors];
}
/**
 * Access the full theme context (including `setTheme`).
 *
 * @throws If called outside a `<ThemeProvider>`.
 */
export function useThemeContext() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useThemeContext() must be used inside a <ThemeProvider>');
    }
    return ctx;
}
// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
/**
 * Resolve a single token to its colour string for the given theme (or dark).
 *
 * Useful outside of React components where hooks are unavailable.
 */
export function getThemeColor(token, themeName = 'dark') {
    const t = themes[themeName] ?? themes.dark;
    return t[token] ?? t.text;
}
// Re-export types and data for convenience
export { themes, themeNames };
//# sourceMappingURL=ThemeProvider.js.map