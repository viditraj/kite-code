/**
 * Permission rule parser.
 *
 * Implements the same logic as Claude Code's permissionRuleParser.ts:
 * - Parse "ToolName(content)" format
 * - Escape/unescape parentheses in rule content
 * - Handle malformed rules gracefully
 * - Normalize legacy tool names
 */
// Legacy tool name aliases (matching Claude Code's LEGACY_TOOL_NAME_ALIASES)
const LEGACY_TOOL_NAME_ALIASES = {
    Task: 'Agent',
    KillShell: 'TaskStop',
    AgentOutputTool: 'TaskOutput',
    BashOutputTool: 'TaskOutput',
};
export function normalizeLegacyToolName(name) {
    return LEGACY_TOOL_NAME_ALIASES[name] ?? name;
}
/**
 * Escape special characters in rule content for safe storage.
 * Order matters: backslashes FIRST, then parentheses.
 */
export function escapeRuleContent(content) {
    return content
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}
/**
 * Unescape special characters in rule content after parsing.
 * Order matters (reverse of escaping): parentheses FIRST, then backslashes.
 */
export function unescapeRuleContent(content) {
    return content
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
}
/**
 * Find the index of the first unescaped occurrence of a character.
 * A character is escaped if preceded by an odd number of backslashes.
 */
function findFirstUnescapedChar(str, char) {
    for (let i = 0; i < str.length; i++) {
        if (str[i] === char) {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && str[j] === '\\') {
                backslashCount++;
                j--;
            }
            if (backslashCount % 2 === 0) {
                return i;
            }
        }
    }
    return -1;
}
/**
 * Find the index of the last unescaped occurrence of a character.
 */
function findLastUnescapedChar(str, char) {
    for (let i = str.length - 1; i >= 0; i--) {
        if (str[i] === char) {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && str[j] === '\\') {
                backslashCount++;
                j--;
            }
            if (backslashCount % 2 === 0) {
                return i;
            }
        }
    }
    return -1;
}
/**
 * Parse a permission rule string into its components.
 * Format: "ToolName" or "ToolName(content)"
 * Content may contain escaped parentheses: \( and \)
 */
export function permissionRuleValueFromString(ruleString) {
    const openParenIndex = findFirstUnescapedChar(ruleString, '(');
    if (openParenIndex === -1) {
        return { toolName: normalizeLegacyToolName(ruleString) };
    }
    const closeParenIndex = findLastUnescapedChar(ruleString, ')');
    if (closeParenIndex === -1 || closeParenIndex <= openParenIndex) {
        return { toolName: normalizeLegacyToolName(ruleString) };
    }
    if (closeParenIndex !== ruleString.length - 1) {
        return { toolName: normalizeLegacyToolName(ruleString) };
    }
    const toolName = ruleString.substring(0, openParenIndex);
    const rawContent = ruleString.substring(openParenIndex + 1, closeParenIndex);
    if (!toolName) {
        return { toolName: normalizeLegacyToolName(ruleString) };
    }
    // Empty content or standalone wildcard → tool-wide rule
    if (rawContent === '' || rawContent === '*') {
        return { toolName: normalizeLegacyToolName(toolName) };
    }
    const ruleContent = unescapeRuleContent(rawContent);
    return { toolName: normalizeLegacyToolName(toolName), ruleContent };
}
/**
 * Convert a permission rule value to its string representation.
 */
export function permissionRuleValueToString(ruleValue) {
    if (!ruleValue.ruleContent) {
        return ruleValue.toolName;
    }
    const escapedContent = escapeRuleContent(ruleValue.ruleContent);
    return `${ruleValue.toolName}(${escapedContent})`;
}
//# sourceMappingURL=permissionRuleParser.js.map