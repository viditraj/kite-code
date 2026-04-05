/**
 * Vim text object resolution.
 *
 * Implements the same text objects as Claude Code's vim/textObjects.ts:
 * - Word/WORD objects (iw, aw, iW, aW)
 * - Quote objects (i", a", i', a', i`, a`)
 * - Bracket objects (i(, a(, i[, a[, i{, a{, i<, a<)
 */
import type { TextObjScope } from './types.js';
export interface TextRange {
    start: number;
    end: number;
}
/**
 * Resolve a text object to a character range within a line.
 */
export declare function resolveTextObject(line: string, col: number, objType: string, scope: TextObjScope): TextRange | null;
//# sourceMappingURL=textObjects.d.ts.map