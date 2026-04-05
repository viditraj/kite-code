/**
 * useVimMode — Vim-style editing hook for the Kite prompt.
 *
 * Provides normal / insert / visual mode editing with standard vim
 * motions and operators.  Designed to be layered on top of a text
 * input component — the hook manages the text value, cursor position
 * and mode, returning everything the UI needs to render.
 */
import { useState, useCallback, useRef } from 'react';
import { useInput } from 'ink';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Find the start of the next word from `pos`. */
function nextWordStart(text, pos) {
    let i = pos;
    // Skip current word characters
    while (i < text.length && text[i] !== ' ' && text[i] !== '\n')
        i++;
    // Skip whitespace
    while (i < text.length && (text[i] === ' ' || text[i] === '\n'))
        i++;
    return Math.min(i, text.length);
}
/** Find the start of the previous word from `pos`. */
function prevWordStart(text, pos) {
    let i = pos - 1;
    // Skip whitespace
    while (i > 0 && (text[i] === ' ' || text[i] === '\n'))
        i--;
    // Skip word characters
    while (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n')
        i--;
    return Math.max(i, 0);
}
const STATUS_LINES = {
    normal: '-- NORMAL --',
    insert: '-- INSERT --',
    visual: '-- VISUAL --',
};
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useVimMode(options = {}) {
    const { initialValue = '', isActive = true, onSubmit } = options;
    const [mode, setModeRaw] = useState('normal');
    const [value, setValueRaw] = useState(initialValue);
    const [cursorPos, setCursorPos] = useState(0);
    // Yank register
    const yankRef = useRef('');
    // Pending operator for multi-key commands (e.g. 'd' waiting for 'd' or motion)
    const pendingRef = useRef(null);
    // ------------------------------------------------------------------
    // Setters with clamping
    // ------------------------------------------------------------------
    const clampCursor = useCallback((pos, text) => Math.max(0, Math.min(pos, Math.max(0, text.length - 1))), []);
    const setValue = useCallback((v) => {
        setValueRaw(v);
        setCursorPos((prev) => Math.max(0, Math.min(prev, Math.max(0, v.length - 1))));
    }, []);
    const setMode = useCallback((m) => {
        setModeRaw(m);
        pendingRef.current = null;
    }, []);
    // ------------------------------------------------------------------
    // Input handler
    // ------------------------------------------------------------------
    const handleInput = useCallback((input, key) => {
        // ================================================================
        //  INSERT MODE
        // ================================================================
        if (mode === 'insert') {
            if (key.escape) {
                // Transition to normal, place cursor back one char.
                setModeRaw('normal');
                setCursorPos((prev) => Math.max(0, prev - 1));
                return;
            }
            if (key.return) {
                onSubmit?.(value);
                return;
            }
            if (key.backspace || key.delete) {
                if (cursorPos > 0) {
                    const next = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
                    setValueRaw(next);
                    setCursorPos((prev) => prev - 1);
                }
                return;
            }
            if (key.leftArrow) {
                setCursorPos((prev) => Math.max(0, prev - 1));
                return;
            }
            if (key.rightArrow) {
                setCursorPos((prev) => Math.min(value.length, prev + 1));
                return;
            }
            // Regular character
            if (input && !key.ctrl && !key.meta) {
                const next = value.slice(0, cursorPos) + input + value.slice(cursorPos);
                setValueRaw(next);
                setCursorPos((prev) => prev + input.length);
            }
            return;
        }
        // ================================================================
        //  VISUAL MODE  (simplified: character-level selection)
        // ================================================================
        if (mode === 'visual') {
            if (key.escape) {
                setMode('normal');
                return;
            }
            // In visual mode, motions just move the cursor (selection
            // would be rendered between anchor and cursor externally).
            if (input === 'h' || key.leftArrow) {
                setCursorPos((prev) => Math.max(0, prev - 1));
                return;
            }
            if (input === 'l' || key.rightArrow) {
                setCursorPos((prev) => clampCursor(prev + 1, value));
                return;
            }
            if (input === 'w') {
                setCursorPos(nextWordStart(value, cursorPos));
                return;
            }
            if (input === 'b') {
                setCursorPos(prevWordStart(value, cursorPos));
                return;
            }
            // 'd' in visual — delete selected (simplified: delete char at cursor)
            if (input === 'd') {
                const next = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
                setValueRaw(next);
                setCursorPos(clampCursor(cursorPos, next));
                setMode('normal');
                return;
            }
            // 'y' — yank (simplified: yank char at cursor)
            if (input === 'y') {
                yankRef.current = value[cursorPos] ?? '';
                setMode('normal');
                return;
            }
            return;
        }
        // ================================================================
        //  NORMAL MODE
        // ================================================================
        if (key.escape) {
            pendingRef.current = null;
            return;
        }
        // ---- Pending operator handling (dd, yy) ----
        const pending = pendingRef.current;
        if (pending !== null) {
            if (pending === 'd' && input === 'd') {
                // dd — delete entire line (clear buffer)
                yankRef.current = value;
                setValueRaw('');
                setCursorPos(0);
                pendingRef.current = null;
                return;
            }
            if (pending === 'y' && input === 'y') {
                // yy — yank entire line
                yankRef.current = value;
                pendingRef.current = null;
                return;
            }
            // Unknown second key — cancel pending.
            pendingRef.current = null;
            return;
        }
        // ---- Mode switches ----
        if (input === 'i') {
            setModeRaw('insert');
            return;
        }
        if (input === 'I') {
            // Insert at line start
            setCursorPos(0);
            setModeRaw('insert');
            return;
        }
        if (input === 'a') {
            // Append after cursor
            setCursorPos((prev) => Math.min(prev + 1, value.length));
            setModeRaw('insert');
            return;
        }
        if (input === 'A') {
            // Append at end of line
            setCursorPos(value.length);
            setModeRaw('insert');
            return;
        }
        if (input === 'o') {
            // Open line below — append newline and enter insert mode
            const next = value + '\n';
            setValueRaw(next);
            setCursorPos(next.length);
            setModeRaw('insert');
            return;
        }
        if (input === 'v') {
            setModeRaw('visual');
            return;
        }
        // ---- Motions ----
        if (input === 'h' || key.leftArrow) {
            setCursorPos((prev) => Math.max(0, prev - 1));
            return;
        }
        if (input === 'l' || key.rightArrow) {
            setCursorPos((prev) => clampCursor(prev + 1, value));
            return;
        }
        if (input === 'w') {
            setCursorPos(nextWordStart(value, cursorPos));
            return;
        }
        if (input === 'b') {
            setCursorPos(prevWordStart(value, cursorPos));
            return;
        }
        if (input === '0') {
            setCursorPos(0);
            return;
        }
        if (input === '$') {
            setCursorPos(Math.max(0, value.length - 1));
            return;
        }
        // ---- Operators ----
        if (input === 'x') {
            // Delete character under cursor
            if (value.length > 0) {
                const next = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
                setValueRaw(next);
                setCursorPos(clampCursor(cursorPos, next.length > 0 ? next : ''));
            }
            return;
        }
        if (input === 'd') {
            pendingRef.current = 'd';
            return;
        }
        if (input === 'y') {
            pendingRef.current = 'y';
            return;
        }
        if (input === 'p') {
            // Paste after cursor
            if (yankRef.current) {
                const insertAt = Math.min(cursorPos + 1, value.length);
                const next = value.slice(0, insertAt) + yankRef.current + value.slice(insertAt);
                setValueRaw(next);
                setCursorPos(insertAt + yankRef.current.length - 1);
            }
            return;
        }
        if (input === 'P') {
            // Paste before cursor
            if (yankRef.current) {
                const next = value.slice(0, cursorPos) + yankRef.current + value.slice(cursorPos);
                setValueRaw(next);
                setCursorPos(cursorPos + yankRef.current.length - 1);
            }
            return;
        }
    }, [mode, value, cursorPos, onSubmit, setMode, clampCursor]);
    // ------------------------------------------------------------------
    // Wire up ink's useInput
    // ------------------------------------------------------------------
    useInput((input, key) => handleInput(input, key), { isActive });
    // ------------------------------------------------------------------
    // Return value
    // ------------------------------------------------------------------
    return {
        mode,
        handleInput,
        cursorPos,
        value,
        statusLine: STATUS_LINES[mode],
        setValue,
        setMode,
    };
}
//# sourceMappingURL=useVimMode.js.map