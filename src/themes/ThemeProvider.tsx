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

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { themes, themeNames, type ThemeName, type ThemeTokens } from './themes.js'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** Current theme name. */
  name: ThemeName
  /** Resolved colour tokens for the current theme. */
  colors: ThemeTokens
  /** Switch to a different theme at runtime. */
  setTheme: (name: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ThemeProviderProps {
  /** Initial theme name. Defaults to 'dark'. */
  themeName?: ThemeName
  children: React.ReactNode
}

export function ThemeProvider({
  themeName = 'dark',
  children,
}: ThemeProviderProps): React.ReactElement {
  const [currentName, setCurrentName] = useState<ThemeName>(themeName)

  const setTheme = useCallback((name: ThemeName) => {
    if (themes[name]) {
      setCurrentName(name)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      name: currentName,
      colors: themes[currentName],
      setTheme,
    }),
    [currentName, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
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
export function useTheme(): [ThemeName, ThemeTokens] {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme() must be used inside a <ThemeProvider>')
  }
  return [ctx.name, ctx.colors]
}

/**
 * Access the full theme context (including `setTheme`).
 *
 * @throws If called outside a `<ThemeProvider>`.
 */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeContext() must be used inside a <ThemeProvider>')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Resolve a single token to its colour string for the given theme (or dark).
 *
 * Useful outside of React components where hooks are unavailable.
 */
export function getThemeColor(
  token: string,
  themeName: ThemeName = 'dark',
): string | undefined {
  const t = themes[themeName] ?? themes.dark
  return t[token] ?? t.text
}

// Re-export types and data for convenience
export { themes, themeNames, type ThemeName, type ThemeTokens }
