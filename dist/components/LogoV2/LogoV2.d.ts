/**
 * LogoV2 — Welcome screen matching Claude Code's visual impact.
 *
 * Uses large block-letter text to render "KITE CODE" in massive characters,
 * similar to the first Claude Code welcome screen. Below the banner:
 * model info, CWD, tips — all clean and professional.
 *
 * Falls back gracefully if ink-big-text/cfonts is not available.
 */
import React from 'react';
export interface LogoProps {
    version?: string;
    model?: string;
    provider?: string;
    cwd?: string;
}
export declare const LogoV2: React.FC<LogoProps>;
export declare const CondensedLogo: React.FC<LogoProps>;
//# sourceMappingURL=LogoV2.d.ts.map