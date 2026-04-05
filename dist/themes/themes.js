/**
 * Theme definitions for Kite.
 *
 * Each theme maps semantic token names to chalk-compatible color strings.
 * Six built-in themes are provided:
 *   - dark / light — standard palettes
 *   - dark-colorblind / light-colorblind — deuteranopia-friendly
 *   - dark-ansi / light-ansi — restricted to the basic 8 ANSI colors
 */
// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------
const dark = {
    primary: 'cyan',
    secondary: 'magenta',
    accent: 'yellow',
    error: 'red',
    warning: 'yellow',
    success: 'green',
    muted: 'gray',
    text: 'white',
    background: 'black',
    border: 'gray',
    kite_brand: 'cyan',
};
const light = {
    primary: 'blue',
    secondary: 'magenta',
    accent: '#b8860b',
    error: 'red',
    warning: '#b8860b',
    success: 'green',
    muted: 'gray',
    text: 'black',
    background: 'white',
    border: 'gray',
    kite_brand: 'blue',
};
const darkColorblind = {
    primary: 'cyan',
    secondary: 'magenta',
    accent: 'yellow',
    error: '#ff8c00', // orange instead of red
    warning: 'yellow',
    success: 'blue', // blue instead of green
    muted: 'gray',
    text: 'white',
    background: 'black',
    border: 'gray',
    kite_brand: 'cyan',
};
const lightColorblind = {
    primary: 'blue',
    secondary: 'magenta',
    accent: '#b8860b',
    error: '#ff8c00', // orange instead of red
    warning: '#b8860b',
    success: 'blue', // blue instead of green
    muted: 'gray',
    text: 'black',
    background: 'white',
    border: 'gray',
    kite_brand: 'blue',
};
const darkAnsi = {
    primary: 'cyan',
    secondary: 'magenta',
    accent: 'yellow',
    error: 'red',
    warning: 'yellow',
    success: 'green',
    muted: 'white', // ANSI basic has no gray; use white dimmed
    text: 'white',
    background: 'black',
    border: 'white',
    kite_brand: 'cyan',
};
const lightAnsi = {
    primary: 'blue',
    secondary: 'magenta',
    accent: 'yellow',
    error: 'red',
    warning: 'yellow',
    success: 'green',
    muted: 'white',
    text: 'black',
    background: 'white',
    border: 'black',
    kite_brand: 'blue',
};
// ---------------------------------------------------------------------------
// Exported map
// ---------------------------------------------------------------------------
export const themes = {
    dark,
    light,
    'dark-colorblind': darkColorblind,
    'light-colorblind': lightColorblind,
    'dark-ansi': darkAnsi,
    'light-ansi': lightAnsi,
};
/** All available theme names. */
export const themeNames = Object.keys(themes);
//# sourceMappingURL=themes.js.map