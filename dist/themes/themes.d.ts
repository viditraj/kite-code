/**
 * Theme definitions for Kite.
 *
 * Each theme maps semantic token names to chalk-compatible color strings.
 * Six built-in themes are provided:
 *   - dark / light — standard palettes
 *   - dark-colorblind / light-colorblind — deuteranopia-friendly
 *   - dark-ansi / light-ansi — restricted to the basic 8 ANSI colors
 */
export type ThemeName = 'dark' | 'light' | 'dark-colorblind' | 'light-colorblind' | 'dark-ansi' | 'light-ansi';
export interface ThemeTokens {
    primary: string;
    secondary: string;
    accent: string;
    error: string;
    warning: string;
    success: string;
    muted: string;
    text: string;
    background: string;
    border: string;
    kite_brand: string;
    [key: string]: string;
}
export declare const themes: Record<ThemeName, ThemeTokens>;
/** All available theme names. */
export declare const themeNames: ThemeName[];
//# sourceMappingURL=themes.d.ts.map