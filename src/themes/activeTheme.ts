/**
 * Global theme state — simple module-level state for the active theme.
 *
 * This avoids needing ThemeProvider context (which requires wrapping
 * the entire app). Components can import and use directly.
 */

import { themes, type ThemeName, type ThemeTokens } from './themes.js'

let currentTheme: ThemeName = 'dark'

export function setActiveTheme(name: ThemeName): void {
  if (themes[name]) {
    currentTheme = name
  }
}

export function getActiveTheme(): ThemeName {
  return currentTheme
}

export function getActiveColors(): ThemeTokens {
  return themes[currentTheme]
}

export function getColor(token: string): string {
  return themes[currentTheme][token] ?? themes[currentTheme].text
}
