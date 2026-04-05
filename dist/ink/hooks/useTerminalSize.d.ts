/**
 * useTerminalSize hook — get current terminal dimensions.
 *
 * Wraps ink's useStdout to provide reactive terminal size,
 * matching Claude Code's useTerminalSize pattern.
 */
export interface TerminalSize {
    columns: number;
    rows: number;
}
/**
 * Returns current terminal dimensions, updating on resize.
 */
export declare function useTerminalSize(): TerminalSize;
//# sourceMappingURL=useTerminalSize.d.ts.map