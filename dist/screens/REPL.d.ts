/**
 * REPL Screen — Main interactive terminal UI.
 *
 * Architecture (matches Ink's recommended patterns):
 *
 *   <Static>         Completed messages — rendered permanently into terminal
 *                    scrollback. The terminal's native scroll handles history.
 *
 *   Live area        Current streaming response + spinner + prompt input +
 *                    status bar. Ink redraws this region each frame.
 *
 * This design gives us:
 * - Native terminal scrollback (mouse wheel, Shift+PgUp, etc.)
 * - No custom ScrollBox needed (the terminal IS the scroll container)
 * - Smooth streaming (only the live area re-renders)
 * - Memory-efficient (Static content is written once and forgotten by React)
 */
import React from 'react';
import type { LLMProvider } from '../providers/types.js';
import type { KiteConfig } from '../utils/config.js';
export interface REPLProps {
    provider: LLMProvider;
    config: KiteConfig;
    initialPrompt?: string;
    options: Record<string, unknown>;
}
export declare const REPL: React.FC<REPLProps>;
//# sourceMappingURL=REPL.d.ts.map