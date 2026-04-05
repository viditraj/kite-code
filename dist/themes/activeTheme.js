/**
 * Global theme state — simple module-level state for the active theme.
 *
 * This avoids needing ThemeProvider context (which requires wrapping
 * the entire app). Components can import and use directly.
 */
import { themes } from './themes.js';
let currentTheme = 'dark';
export function setActiveTheme(name) {
    if (themes[name]) {
        currentTheme = name;
    }
}
export function getActiveTheme() {
    return currentTheme;
}
export function getActiveColors() {
    return themes[currentTheme];
}
export function getColor(token) {
    return themes[currentTheme][token] ?? themes[currentTheme].text;
}
//# sourceMappingURL=activeTheme.js.map