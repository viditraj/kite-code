/**
 * Vim motion resolution.
 *
 * Maps motion keys to cursor movement functions.
 * Implements the same motions as Claude Code's vim/motions.ts.
 */
export interface CursorPosition {
    line: number;
    col: number;
}
export interface TextBuffer {
    lines: string[];
    cursor: CursorPosition;
}
export type MotionResult = {
    newCursor: CursorPosition;
    linewise: boolean;
};
/**
 * Resolve a motion key to a cursor movement.
 */
export declare function resolveMotion(key: string, buffer: TextBuffer, count: number): MotionResult | null;
//# sourceMappingURL=motions.d.ts.map