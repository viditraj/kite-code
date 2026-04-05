/**
 * useVimMode — Vim-style editing hook for the Kite prompt.
 *
 * Provides normal / insert / visual mode editing with standard vim
 * motions and operators.  Designed to be layered on top of a text
 * input component — the hook manages the text value, cursor position
 * and mode, returning everything the UI needs to render.
 */
export type VimModeType = 'normal' | 'insert' | 'visual';
export interface VimModeResult {
    /** Current vim mode. */
    mode: VimModeType;
    /** Handle raw input — call this from useInput if you need to wrap. */
    handleInput: (input: string, key: InputKey) => void;
    /** Current cursor position (0-based index into `value`). */
    cursorPos: number;
    /** Current text value. */
    value: string;
    /** Status-line string, e.g. "-- INSERT --" */
    statusLine: string;
    /** Programmatically set the value (e.g. to load initial text). */
    setValue: (v: string) => void;
    /** Programmatically switch modes. */
    setMode: (m: VimModeType) => void;
}
export interface UseVimModeOptions {
    /** Initial text. */
    initialValue?: string;
    /** Whether the hook listens for input. */
    isActive?: boolean;
    /** Called when the user submits (Enter in insert mode). */
    onSubmit?: (value: string) => void;
}
/** Subset of ink's Key type we rely on. */
interface InputKey {
    escape?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    tab?: boolean;
}
export declare function useVimMode(options?: UseVimModeOptions): VimModeResult;
export {};
//# sourceMappingURL=useVimMode.d.ts.map