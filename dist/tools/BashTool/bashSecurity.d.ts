/**
 * Bash command security validators.
 *
 * Implements the same 23 security checks as Claude Code's bashSecurity.ts:
 * - Injection detection (command substitution, process substitution, etc.)
 * - Obfuscation detection (ANSI-C quoting, empty quotes, brace expansion)
 * - Parser differential mitigations (CR, unicode whitespace, mid-word hash)
 * - Redirection and newline detection
 * - Zsh dangerous command detection
 *
 * Each validator returns a PermissionResult.
 * The validation chain runs all validators in a specific order.
 */
import type { PermissionResult } from '../../Tool.js';
export declare const BASH_SECURITY_CHECK_IDS: {
    readonly INCOMPLETE_COMMANDS: 1;
    readonly JQ_SYSTEM_FUNCTION: 2;
    readonly JQ_FILE_ARGUMENTS: 3;
    readonly OBFUSCATED_FLAGS: 4;
    readonly SHELL_METACHARACTERS: 5;
    readonly DANGEROUS_VARIABLES: 6;
    readonly NEWLINES: 7;
    readonly DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION: 8;
    readonly DANGEROUS_PATTERNS_INPUT_REDIRECTION: 9;
    readonly DANGEROUS_PATTERNS_OUTPUT_REDIRECTION: 10;
    readonly IFS_INJECTION: 11;
    readonly GIT_COMMIT_SUBSTITUTION: 12;
    readonly PROC_ENVIRON_ACCESS: 13;
    readonly MALFORMED_TOKEN_INJECTION: 14;
    readonly BACKSLASH_ESCAPED_WHITESPACE: 15;
    readonly BRACE_EXPANSION: 16;
    readonly CONTROL_CHARACTERS: 17;
    readonly UNICODE_WHITESPACE: 18;
    readonly MID_WORD_HASH: 19;
    readonly ZSH_DANGEROUS_COMMANDS: 20;
    readonly BACKSLASH_ESCAPED_OPERATORS: 21;
    readonly COMMENT_QUOTE_DESYNC: 22;
    readonly QUOTED_NEWLINE: 23;
};
export interface ValidationContext {
    originalCommand: string;
    baseCommand: string;
    /** Single-quoted content stripped, double-quote delimiters stripped */
    unquotedContent: string;
    /** All quoted content stripped, safe redirections stripped */
    fullyUnquotedContent: string;
    /** All quoted content stripped, before safe-redirection stripping */
    fullyUnquotedPreStrip: string;
    /** Quoted content stripped but quote delimiters preserved */
    unquotedKeepQuoteChars: string;
}
export declare function validateEmpty(ctx: ValidationContext): PermissionResult;
export declare function validateIncompleteCommands(ctx: ValidationContext): PermissionResult;
export declare function validateSafeCommandSubstitution(ctx: ValidationContext): PermissionResult;
export declare function validateGitCommit(ctx: ValidationContext): PermissionResult;
export declare function validateJqCommand(ctx: ValidationContext): PermissionResult;
export declare function validateObfuscatedFlags(ctx: ValidationContext): PermissionResult;
export declare function validateShellMetacharacters(ctx: ValidationContext): PermissionResult;
export declare function validateDangerousVariables(ctx: ValidationContext): PermissionResult;
export declare function validateCommentQuoteDesync(ctx: ValidationContext): PermissionResult;
export declare function validateQuotedNewline(ctx: ValidationContext): PermissionResult;
export declare function validateCarriageReturn(ctx: ValidationContext): PermissionResult;
export declare function validateNewlines(ctx: ValidationContext): PermissionResult;
export declare function validateIFSInjection(ctx: ValidationContext): PermissionResult;
export declare function validateProcEnvironAccess(ctx: ValidationContext): PermissionResult;
export declare function validateDangerousPatterns(ctx: ValidationContext): PermissionResult;
export declare function validateRedirections(ctx: ValidationContext): PermissionResult;
export declare function validateBackslashEscapedWhitespace(ctx: ValidationContext): PermissionResult;
export declare function validateBackslashEscapedOperators(ctx: ValidationContext): PermissionResult;
export declare function validateUnicodeWhitespace(ctx: ValidationContext): PermissionResult;
export declare function validateMidWordHash(ctx: ValidationContext): PermissionResult;
export declare function validateBraceExpansion(ctx: ValidationContext): PermissionResult;
export declare function validateZshDangerousCommands(ctx: ValidationContext): PermissionResult;
export declare function validateMalformedTokenInjection(ctx: ValidationContext): PermissionResult;
/**
 * Run all bash security validators on a command.
 *
 * Returns 'allow' (early allow), 'ask' (blocked), or 'passthrough' (all checks passed).
 */
export declare function bashCommandIsSafe(command: string): PermissionResult;
//# sourceMappingURL=bashSecurity.d.ts.map