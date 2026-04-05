/**
 * Vim Mode State Machine Types
 *
 * Implements the same state machine as Claude Code's vim/types.ts:
 * - INSERT mode: tracks text being typed (for dot-repeat)
 * - NORMAL mode: tracks command being parsed (state machine)
 * - Complete operator/motion/text-object/find model
 * - Persistent state for dot-repeat, last find, register
 */
// ============================================================================
// Key Groups
// ============================================================================
export const OPERATORS = {
    d: 'delete',
    c: 'change',
    y: 'yank',
};
export function isOperatorKey(key) {
    return key in OPERATORS;
}
export const SIMPLE_MOTIONS = new Set([
    'h', 'l', 'j', 'k', // Basic movement
    'w', 'b', 'e', 'W', 'B', 'E', // Word motions
    '0', '^', '$', // Line positions
]);
export const FIND_KEYS = new Set(['f', 'F', 't', 'T']);
export const TEXT_OBJ_SCOPES = {
    i: 'inner',
    a: 'around',
};
export function isTextObjScopeKey(key) {
    return key in TEXT_OBJ_SCOPES;
}
export const TEXT_OBJ_TYPES = new Set([
    'w', 'W', // Word/WORD
    '"', "'", '`', // Quotes
    '(', ')', 'b', // Parens
    '[', ']', // Brackets
    '{', '}', 'B', // Braces
    '<', '>', // Angle brackets
]);
export const MAX_VIM_COUNT = 10000;
// ============================================================================
// State Factories
// ============================================================================
export function createInitialVimState() {
    return { mode: 'INSERT', insertedText: '' };
}
export function createInitialPersistentState() {
    return {
        lastChange: null,
        lastFind: null,
        register: '',
        registerIsLinewise: false,
    };
}
//# sourceMappingURL=types.js.map