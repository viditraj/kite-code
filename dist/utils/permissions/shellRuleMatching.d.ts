/**
 * Shell permission rule matching.
 *
 * Implements the same logic as Claude Code's shellRuleMatching.ts:
 * - Wildcard pattern matching with * (dotAll for newlines)
 * - Legacy :* prefix syntax
 * - Escaped star (\*) for literal asterisks
 * - Optional trailing space+wildcard for single-wildcard patterns
 */
export type ShellPermissionRule = {
    type: 'exact';
    command: string;
} | {
    type: 'prefix';
    prefix: string;
} | {
    type: 'wildcard';
    pattern: string;
};
/**
 * Extract prefix from legacy :* syntax (e.g., "npm:*" → "npm").
 */
export declare function permissionRuleExtractPrefix(permissionRule: string): string | null;
/**
 * Check if a pattern contains unescaped wildcards (not legacy :* syntax).
 */
export declare function hasWildcards(pattern: string): boolean;
/**
 * Match a command against a wildcard pattern.
 *
 * Wildcards (*) match any sequence of characters including newlines.
 * Use \* for literal asterisk, \\ for literal backslash.
 *
 * When pattern ends with ' *' and it's the only wildcard,
 * the trailing space+args are optional (so 'git *' matches bare 'git').
 */
export declare function matchWildcardPattern(pattern: string, command: string, caseInsensitive?: boolean): boolean;
/**
 * Parse a permission rule string into a structured rule object.
 */
export declare function parsePermissionRule(permissionRule: string): ShellPermissionRule;
//# sourceMappingURL=shellRuleMatching.d.ts.map