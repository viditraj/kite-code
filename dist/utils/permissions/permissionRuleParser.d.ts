/**
 * Permission rule parser.
 *
 * Implements the same logic as Claude Code's permissionRuleParser.ts:
 * - Parse "ToolName(content)" format
 * - Escape/unescape parentheses in rule content
 * - Handle malformed rules gracefully
 * - Normalize legacy tool names
 */
import type { PermissionRuleValue } from '../../types/permissions.js';
export declare function normalizeLegacyToolName(name: string): string;
/**
 * Escape special characters in rule content for safe storage.
 * Order matters: backslashes FIRST, then parentheses.
 */
export declare function escapeRuleContent(content: string): string;
/**
 * Unescape special characters in rule content after parsing.
 * Order matters (reverse of escaping): parentheses FIRST, then backslashes.
 */
export declare function unescapeRuleContent(content: string): string;
/**
 * Parse a permission rule string into its components.
 * Format: "ToolName" or "ToolName(content)"
 * Content may contain escaped parentheses: \( and \)
 */
export declare function permissionRuleValueFromString(ruleString: string): PermissionRuleValue;
/**
 * Convert a permission rule value to its string representation.
 */
export declare function permissionRuleValueToString(ruleValue: PermissionRuleValue): string;
//# sourceMappingURL=permissionRuleParser.d.ts.map