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
export interface Redirect {
    op: '>' | '>>' | '<' | '<<' | '>&' | '>|' | '<&' | '&>' | '&>>' | '<<<';
    target: string;
    fd?: number;
}
export interface SimpleCommand {
    /** Resolved command + arguments (quotes removed, vars resolved) */
    argv: string[];
    /** VAR=value prefixes on this command */
    envVars: {
        name: string;
        value: string;
    }[];
    /** File redirections */
    redirects: Redirect[];
    /** Original source text of this command */
    text: string;
}
export type ParseForSecurityResult = {
    kind: 'simple';
    commands: SimpleCommand[];
} | {
    kind: 'too-complex';
    reason: string;
    nodeType?: string;
} | {
    kind: 'parse-unavailable';
};
export type SemanticCheckResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
export declare const REDIRECT_OPS: Record<string, Redirect['op']>;
export declare const ALLOWED_FILE_DESCRIPTORS: Set<string>;
export declare const EVAL_LIKE_BUILTINS: Set<string>;
export declare const ZSH_DANGEROUS_BUILTINS: Set<string>;
export declare const SAFE_ENV_VARS: Set<string>;
export declare const SPECIAL_VAR_NAMES: Set<string>;
export declare const SUBSCRIPT_EVAL_FLAGS: Record<string, Set<string>>;
export declare const TEST_ARITH_CMP_OPS: Set<string>;
export declare const BARE_SUBSCRIPT_NAME_BUILTINS: Set<string>;
export declare const READ_DATA_FLAGS: Set<string>;
export declare const CMDSUB_PLACEHOLDER = "__CMDSUB_OUTPUT__";
export declare const VAR_PLACEHOLDER = "__TRACKED_VAR__";
export declare function containsAnyPlaceholder(s: string): boolean;
/** Null bytes and control characters (tree-sitter/bash differential) */
export declare const CONTROL_CHAR_RE: RegExp;
/** Invisible Unicode whitespace (shell-quote treats as separator, bash as literal) */
export declare const UNICODE_WHITESPACE_RE: RegExp;
/** Backslash-escaped space/tab or word-joining backslash-newline */
export declare const BACKSLASH_WHITESPACE_RE: RegExp;
/** Zsh ~[name] dynamic directory expansion */
export declare const ZSH_TILDE_BRACKET_RE: RegExp;
/** Zsh =cmd equals expansion (word-initial) */
export declare const ZSH_EQUALS_EXPANSION_RE: RegExp;
/** Brace with quoted content obfuscation */
export declare const BRACE_WITH_QUOTE_RE: RegExp;
export declare const PROC_ENVIRON_RE: RegExp;
/** Newline followed by # (downstream comment hiding) */
export declare const NEWLINE_HASH_RE: RegExp;
/** Bare variable unsafe chars (word-splitting/globbing if unquoted) */
export declare const BARE_VAR_UNSAFE_RE: RegExp;
/** Brace expansion detection */
export declare const BRACE_EXPANSION_RE: RegExp;
/** Arithmetic leaf validation (only literals + operators) */
export declare const ARITH_LEAF_RE: RegExp;
export interface QuoteExtraction {
    /** Single-quoted content stripped, double-quote delimiters stripped */
    withDoubleQuotes: string;
    /** All quoted content stripped */
    fullyUnquoted: string;
    /** Quoted content stripped but quote delimiters kept */
    unquotedKeepQuoteChars: string;
}
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
export declare function extractQuotedContent(command: string, isJq?: boolean): QuoteExtraction;
/**
 * Strip safe output redirections (2>&1, >/dev/null, </dev/null).
 *
 * SECURITY: All patterns MUST have trailing boundary (?=\s|$).
 * Without it, `> /dev/nullo` prefix-matches `/dev/null`, strips it,
 * leaving `o` — validateRedirections then sees no `>` and passes.
 */
export declare function stripSafeRedirections(content: string): string;
export declare function isEscapedAtPosition(str: string, pos: number): boolean;
/**
 * Check if a string contains an unescaped occurrence of a character.
 */
export declare function hasUnescapedChar(str: string, char: string): boolean;
export declare const STRUCTURAL_TYPES: Set<string>;
export declare const SEPARATOR_TYPES: Set<string>;
export declare function tooComplex(reason: string, nodeType?: string): ParseForSecurityResult;
//# sourceMappingURL=ast.d.ts.map