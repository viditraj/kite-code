/**
 * useKeybindings — Modal keyboard shortcut manager.
 *
 * Manages a set of mode-specific key bindings (normal, insert, command,
 * search, visual) and dispatches the appropriate callback when a key
 * is pressed, integrating with ink's useInput.
 *
 * Pre-registers sensible defaults for each mode so consumers can use it
 * out of the box or override individual bindings.
 */
export type KeybindingMode = 'normal' | 'insert' | 'command' | 'search' | 'visual';
export type KeyAction = () => void;
export interface KeybindingsResult {
    /** The currently active mode. */
    mode: KeybindingMode;
    /** Programmatically switch modes. */
    setMode: (mode: KeybindingMode) => void;
    /** Register (or override) a binding for a mode + key. */
    registerBinding: (mode: KeybindingMode, key: string, action: KeyAction) => void;
    /** Unregister a binding. */
    unregisterBinding: (mode: KeybindingMode, key: string) => void;
    /** Read-only snapshot of the bindings for the current mode. */
    currentBindings: ReadonlyMap<string, KeyAction>;
}
export interface UseKeybindingsOptions {
    /** Starting mode. Defaults to 'normal'. */
    initialMode?: KeybindingMode;
    /** Whether the hook should intercept input. Defaults to true. */
    isActive?: boolean;
    /** Callback fired whenever the mode changes. */
    onModeChange?: (from: KeybindingMode, to: KeybindingMode) => void;
    /** Callback for scroll-up in normal mode ('k'). */
    onScrollUp?: () => void;
    /** Callback for scroll-down in normal mode ('j'). */
    onScrollDown?: () => void;
    /** Callback for quit in normal mode ('q'). */
    onQuit?: () => void;
    /** Callback for execute in command mode ('Enter'). */
    onExecute?: () => void;
    /** Callback for next search match ('n' in search mode). */
    onNextMatch?: () => void;
    /** Callback for previous search match ('N' in search mode). */
    onPrevMatch?: () => void;
}
export declare function useKeybindings(options?: UseKeybindingsOptions): KeybindingsResult;
//# sourceMappingURL=useKeybindings.d.ts.map