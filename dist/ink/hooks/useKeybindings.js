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
import { useState, useCallback, useRef, useMemo } from 'react';
import { useInput } from 'ink';
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useKeybindings(options = {}) {
    const { initialMode = 'normal', isActive = true, onModeChange, onScrollUp, onScrollDown, onQuit, onExecute, onNextMatch, onPrevMatch, } = options;
    const [mode, setModeRaw] = useState(initialMode);
    // Store bindings in a ref so mutations don't trigger re-renders.
    // The map is mode -> (key -> action).
    const bindingsRef = useRef(new Map());
    // Helper: get-or-create the inner map for a mode.
    const getMap = useCallback((m) => {
        let inner = bindingsRef.current.get(m);
        if (!inner) {
            inner = new Map();
            bindingsRef.current.set(m, inner);
        }
        return inner;
    }, []);
    // ------------------------------------------------------------------
    // Set mode wrapper that fires the optional callback.
    // ------------------------------------------------------------------
    const setMode = useCallback((next) => {
        setModeRaw((prev) => {
            if (prev !== next) {
                onModeChange?.(prev, next);
            }
            return next;
        });
    }, [onModeChange]);
    // ------------------------------------------------------------------
    // Pre-register default bindings (runs once via lazy init).
    // ------------------------------------------------------------------
    const initialised = useRef(false);
    if (!initialised.current) {
        initialised.current = true;
        // ---- Normal mode ----
        const normal = getMap('normal');
        normal.set('i', () => setMode('insert'));
        normal.set(':', () => setMode('command'));
        normal.set('/', () => setMode('search'));
        normal.set('q', () => onQuit?.());
        normal.set('k', () => onScrollUp?.());
        normal.set('j', () => onScrollDown?.());
        normal.set('v', () => setMode('visual'));
        // ---- Insert mode ----
        const insert = getMap('insert');
        insert.set('Escape', () => setMode('normal'));
        // ---- Search mode ----
        const search = getMap('search');
        search.set('Escape', () => setMode('normal'));
        search.set('n', () => onNextMatch?.());
        search.set('N', () => onPrevMatch?.());
        // ---- Command mode ----
        const command = getMap('command');
        command.set('Escape', () => setMode('normal'));
        command.set('Enter', () => onExecute?.());
        // ---- Visual mode ----
        const visual = getMap('visual');
        visual.set('Escape', () => setMode('normal'));
    }
    // ------------------------------------------------------------------
    // Public mutators
    // ------------------------------------------------------------------
    const registerBinding = useCallback((m, key, action) => {
        getMap(m).set(key, action);
    }, [getMap]);
    const unregisterBinding = useCallback((m, key) => {
        getMap(m).delete(key);
    }, [getMap]);
    // ------------------------------------------------------------------
    // Input handler — dispatches to the binding map for the active mode.
    // ------------------------------------------------------------------
    useInput((input, key) => {
        // Normalise the key to a string identifier.
        let keyName;
        if (key.escape) {
            keyName = 'Escape';
        }
        else if (key.return) {
            keyName = 'Enter';
        }
        else if (key.backspace || key.delete) {
            keyName = 'Backspace';
        }
        else if (key.tab) {
            keyName = 'Tab';
        }
        else if (key.upArrow) {
            keyName = 'Up';
        }
        else if (key.downArrow) {
            keyName = 'Down';
        }
        else if (key.leftArrow) {
            keyName = 'Left';
        }
        else if (key.rightArrow) {
            keyName = 'Right';
        }
        else if (key.ctrl && input) {
            keyName = `Ctrl+${input}`;
        }
        else if (key.meta && input) {
            keyName = `Meta+${input}`;
        }
        else {
            keyName = input;
        }
        const modeBindings = bindingsRef.current.get(mode);
        if (!modeBindings)
            return;
        const action = modeBindings.get(keyName);
        if (action) {
            action();
        }
    }, { isActive });
    // ------------------------------------------------------------------
    // Read-only snapshot of current-mode bindings (for display / help).
    // ------------------------------------------------------------------
    const currentBindings = useMemo(() => {
        return new Map(getMap(mode));
    }, [mode, getMap]);
    return { mode, setMode, registerBinding, unregisterBinding, currentBindings };
}
//# sourceMappingURL=useKeybindings.js.map