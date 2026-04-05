/**
 * Vim operator execution.
 *
 * Implements the same operators as Claude Code's vim/operators.ts:
 * - delete, change, yank with motions and text objects
 * - x (delete char), ~ (toggle case), J (join lines)
 * - p/P (paste), o/O (open line)
 * - r (replace char)
 * - >>/<<  (indent)
 */
import type { Operator, FindType, TextObjScope, RecordedChange, PersistentState } from './types.js';
import { type TextBuffer, type CursorPosition } from './motions.js';
export interface OperatorContext {
    /** Get current buffer state */
    getBuffer(): TextBuffer;
    /** Replace text in range */
    replaceRange(startLine: number, startCol: number, endLine: number, endCol: number, text: string): void;
    /** Delete a range of lines */
    deleteLines(startLine: number, count: number): string[];
    /** Insert text at cursor */
    insertAt(line: number, col: number, text: string): void;
    /** Set cursor position */
    setCursor(pos: CursorPosition): void;
    /** Get persistent state */
    getPersistent(): PersistentState;
    /** Update persistent state */
    setPersistent(update: Partial<PersistentState>): void;
    /** Switch to insert mode */
    enterInsertMode(): void;
    /** Copy text to system clipboard (optional) */
    copyToClipboard?(text: string): void;
}
export declare function executeOperatorMotion(op: Operator, motionKey: string, count: number, ctx: OperatorContext): RecordedChange | null;
export declare function executeOperatorTextObj(op: Operator, objType: string, scope: TextObjScope, count: number, ctx: OperatorContext): RecordedChange | null;
export declare function executeOperatorFind(op: Operator, findType: FindType, char: string, count: number, ctx: OperatorContext): RecordedChange | null;
export declare function executeLineOp(op: Operator, count: number, ctx: OperatorContext): RecordedChange | null;
export declare function executeX(count: number, ctx: OperatorContext): RecordedChange;
export declare function executeToggleCase(count: number, ctx: OperatorContext): RecordedChange;
export declare function executeReplace(char: string, count: number, ctx: OperatorContext): RecordedChange;
export declare function executePaste(before: boolean, ctx: OperatorContext): void;
export declare function executeOpenLine(direction: 'above' | 'below', ctx: OperatorContext): RecordedChange;
export declare function executeJoin(count: number, ctx: OperatorContext): RecordedChange;
export declare function executeIndent(dir: '>' | '<', count: number, ctx: OperatorContext): RecordedChange;
export declare function executeOperatorG(op: Operator, count: number, ctx: OperatorContext): RecordedChange | null;
export declare function executeOperatorGg(op: Operator, count: number, ctx: OperatorContext): RecordedChange | null;
//# sourceMappingURL=operators.d.ts.map