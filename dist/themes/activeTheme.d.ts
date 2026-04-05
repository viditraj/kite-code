/**
 * Global theme state — simple module-level state for the active theme.
 *
 * This avoids needing ThemeProvider context (which requires wrapping
 * the entire app). Components can import and use directly.
 */
import { type ThemeName, type ThemeTokens } from './themes.js';
export declare function setActiveTheme(name: ThemeName): void;
export declare function getActiveTheme(): ThemeName;
export declare function getActiveColors(): ThemeTokens;
export declare function getColor(token: string): string;
//# sourceMappingURL=activeTheme.d.ts.map