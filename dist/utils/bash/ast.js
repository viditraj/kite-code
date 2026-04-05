/**
 * Bash AST types and security analysis structures.
 *
 * Core types for the bash security system:
 * - SimpleCommand: parsed command with argv, env vars, redirects
 * - ParseForSecurityResult: result of security-oriented parsing
 * - Redirect: file redirection with operator and target
 * - Quote extraction utilities
 * - Pre-check regexes for known parser differentials
 *
 * Design: fail-closed. Unknown constructs → too-complex → ask user.
 */
// ============================================================================
// Redirect operators
// ============================================================================
export const REDIRECT_OPS = {
    '>': '>',
    '>>': '>>',
    '<': '<',
    '>&': '>&',
    '<&': '<&',
    '>|': '>|',
    '&>': '&>',
    '&>>': '&>>',
    '<<<': '<<<',
};
export const ALLOWED_FILE_DESCRIPTORS = new Set(['0', '1', '2']);
// ============================================================================
// Dangerous / eval-like builtins
// ============================================================================
export const EVAL_LIKE_BUILTINS = new Set([
    'eval', 'source', '.', 'exec', 'command', 'builtin', 'fc',
    'coproc', 'noglob', 'nocorrect', 'trap', 'enable',
    'mapfile', 'readarray', 'hash', 'bind', 'complete', 'compgen',
    'alias', 'let',
]);
export const ZSH_DANGEROUS_BUILTINS = new Set([
    'zmodload', 'emulate', 'sysopen', 'sysread', 'syswrite', 'sysseek',
    'zpty', 'ztcp', 'zsocket', 'zf_rm', 'zf_mv', 'zf_ln', 'zf_chmod',
    'zf_chown', 'zf_mkdir', 'zf_rmdir', 'zf_chgrp',
]);
// ============================================================================
// Safe environment variables (known not to execute code or load libraries)
// ============================================================================
export const SAFE_ENV_VARS = new Set([
    'HOME', 'PWD', 'OLDPWD', 'USER', 'LOGNAME', 'SHELL', 'PATH',
    'HOSTNAME', 'UID', 'EUID', 'PPID', 'RANDOM', 'SECONDS', 'LINENO',
    'TMPDIR', 'BASH_VERSION', 'BASHPID', 'SHLVL', 'HISTFILE', 'IFS',
]);
export const SPECIAL_VAR_NAMES = new Set(['?', '$', '!', '#', '0', '-']);
// ============================================================================
// Subscript evaluation flags — bash evaluates arr[$(cmd)] arithmetically
// ============================================================================
export const SUBSCRIPT_EVAL_FLAGS = {
    test: new Set(['-v', '-R']),
    '[': new Set(['-v', '-R']),
    '[[': new Set(['-v', '-R']),
    printf: new Set(['-v']),
    read: new Set(['-a']),
    unset: new Set(['-v']),
    wait: new Set(['-p']),
};
export const TEST_ARITH_CMP_OPS = new Set(['-eq', '-ne', '-lt', '-le', '-gt', '-ge']);
export const BARE_SUBSCRIPT_NAME_BUILTINS = new Set(['read', 'unset']);
export const READ_DATA_FLAGS = new Set(['-p', '-d', '-n', '-N', '-t', '-u', '-i']);
// ============================================================================
// Placeholder strings for variable/command-substitution tracking
// ============================================================================
export const CMDSUB_PLACEHOLDER = '__CMDSUB_OUTPUT__';
export const VAR_PLACEHOLDER = '__TRACKED_VAR__';
export function containsAnyPlaceholder(s) {
    return s.includes(CMDSUB_PLACEHOLDER) || s.includes(VAR_PLACEHOLDER);
}
// ============================================================================
// Pre-check regexes (run before parsing — known parser differentials)
// ============================================================================
/** Null bytes and control characters (tree-sitter/bash differential) */
export const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
/** Invisible Unicode whitespace (shell-quote treats as separator, bash as literal) */
export const UNICODE_WHITESPACE_RE = /[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/;
/** Backslash-escaped space/tab or word-joining backslash-newline */
export const BACKSLASH_WHITESPACE_RE = /\\[ \t]|[^ \t\n\\]\\\n/;
/** Zsh ~[name] dynamic directory expansion */
export const ZSH_TILDE_BRACKET_RE = /~\[/;
/** Zsh =cmd equals expansion (word-initial) */
export const ZSH_EQUALS_EXPANSION_RE = /(?:^|[\s;&|])=[a-zA-Z_]/;
/** Brace with quoted content obfuscation */
export const BRACE_WITH_QUOTE_RE = /\{[^}]*['"]/;
// /proc/.../environ access (process memory leak)
export const PROC_ENVIRON_RE = /\/proc\/.*\/environ/;
/** Newline followed by # (downstream comment hiding) */
export const NEWLINE_HASH_RE = /\n[ \t]*#/;
/** Bare variable unsafe chars (word-splitting/globbing if unquoted) */
export const BARE_VAR_UNSAFE_RE = /[ \t\n*?[]/;
/** Brace expansion detection */
export const BRACE_EXPANSION_RE = /\{[^{}\s]*(,|\.\.)[^{}\s]*\}/;
/** Arithmetic leaf validation (only literals + operators) */
export const ARITH_LEAF_RE = /^(?:[0-9]+|0[xX][0-9a-fA-F]+|[0-9]+#[0-9a-zA-Z]+|[-+*/%^&|~!<>=?:(),]+|<<|>>|\*\*|&&|\|\||[<>=!]=|\$\(\(|\)\))$/;
/**
 * Extract content with three quote-stripping variations.
 *
 * - withDoubleQuotes: single-quoted spans removed, double-quote chars removed
 * - fullyUnquoted: all quoted content removed
 * - unquotedKeepQuoteChars: quoted content removed but delimiters preserved
 *
 * Single quotes suppress ALL escaping (backslash is literal inside).
 * Double quotes allow backslash escaping.
 */
export function extractQuotedContent(command, isJq = false) {
    let withDoubleQuotes = '';
    let fullyUnquoted = '';
    let unquotedKeepQuoteChars = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;
    for (let i = 0; i < command.length; i++) {
        const char = command[i];
        if (escaped) {
            escaped = false;
            if (!inSingleQuote)
                withDoubleQuotes += char;
            if (!inSingleQuote && !inDoubleQuote)
                fullyUnquoted += char;
            if (!inSingleQuote && !inDoubleQuote)
                unquotedKeepQuoteChars += char;
            continue;
        }
        if (char === '\\' && !inSingleQuote) {
            escaped = true;
            if (!inSingleQuote)
                withDoubleQuotes += char;
            if (!inSingleQuote && !inDoubleQuote)
                fullyUnquoted += char;
            if (!inSingleQuote && !inDoubleQuote)
                unquotedKeepQuoteChars += char;
            continue;
        }
        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            unquotedKeepQuoteChars += char;
            continue;
        }
        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            unquotedKeepQuoteChars += char;
            if (!isJq)
                continue;
        }
        if (!inSingleQuote)
            withDoubleQuotes += char;
        if (!inSingleQuote && !inDoubleQuote)
            fullyUnquoted += char;
        if (!inSingleQuote && !inDoubleQuote)
            unquotedKeepQuoteChars += char;
    }
    return { withDoubleQuotes, fullyUnquoted, unquotedKeepQuoteChars };
}
// ============================================================================
// Safe redirection stripping
// ============================================================================
/**
 * Strip safe output redirections (2>&1, >/dev/null, </dev/null).
 *
 * SECURITY: All patterns MUST have trailing boundary (?=\s|$).
 * Without it, `> /dev/nullo` prefix-matches `/dev/null`, strips it,
 * leaving `o` — validateRedirections then sees no `>` and passes.
 */
export function stripSafeRedirections(content) {
    return content
        .replace(/\s+2\s*>&\s*1(?=\s|$)/g, '')
        .replace(/[012]?\s*>\s*\/dev\/null(?=\s|$)/g, '')
        .replace(/\s*<\s*\/dev\/null(?=\s|$)/g, '');
}
// ============================================================================
// Helper: check if character at position is backslash-escaped
// ============================================================================
export function isEscapedAtPosition(str, pos) {
    let backslashes = 0;
    let j = pos - 1;
    while (j >= 0 && str[j] === '\\') {
        backslashes++;
        j--;
    }
    return backslashes % 2 === 1;
}
/**
 * Check if a string contains an unescaped occurrence of a character.
 */
export function hasUnescapedChar(str, char) {
    for (let i = 0; i < str.length; i++) {
        if (str[i] === char && !isEscapedAtPosition(str, i)) {
            return true;
        }
    }
    return false;
}
// ============================================================================
// Structural / separator node types (for AST walking)
// ============================================================================
export const STRUCTURAL_TYPES = new Set([
    'program',
    'list',
    'pipeline',
    'redirected_statement',
]);
export const SEPARATOR_TYPES = new Set([
    '&&', '||', '|', ';', '&', '|&', '\n',
]);
// ============================================================================
// tooComplex helper
// ============================================================================
export function tooComplex(reason, nodeType) {
    return { kind: 'too-complex', reason, nodeType };
}
//# sourceMappingURL=ast.js.map