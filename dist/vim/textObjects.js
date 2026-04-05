/**
 * Vim text object resolution.
 *
 * Implements the same text objects as Claude Code's vim/textObjects.ts:
 * - Word/WORD objects (iw, aw, iW, aW)
 * - Quote objects (i", a", i', a', i`, a`)
 * - Bracket objects (i(, a(, i[, a[, i{, a{, i<, a<)
 */
/**
 * Resolve a text object to a character range within a line.
 */
export function resolveTextObject(line, col, objType, scope) {
    switch (objType) {
        case 'w':
            return resolveWordObject(line, col, scope, false);
        case 'W':
            return resolveWordObject(line, col, scope, true);
        case '"':
        case "'":
        case '`':
            return resolveQuoteObject(line, col, objType, scope);
        case '(':
        case ')':
        case 'b':
            return resolveBracketObject(line, col, '(', ')', scope);
        case '[':
        case ']':
            return resolveBracketObject(line, col, '[', ']', scope);
        case '{':
        case '}':
        case 'B':
            return resolveBracketObject(line, col, '{', '}', scope);
        case '<':
        case '>':
            return resolveBracketObject(line, col, '<', '>', scope);
        default:
            return null;
    }
}
// ============================================================================
// Word objects
// ============================================================================
const WORD_RE = /[a-zA-Z0-9_]/;
function resolveWordObject(line, col, scope, bigWord) {
    if (col >= line.length)
        return null;
    const isWordChar = bigWord
        ? (ch) => ch !== ' ' && ch !== '\t'
        : (ch) => WORD_RE.test(ch);
    const charAtCol = line[col];
    const onWord = isWordChar(charAtCol);
    // Find word boundaries
    let start = col;
    let end = col;
    if (onWord) {
        while (start > 0 && isWordChar(line[start - 1]))
            start--;
        while (end < line.length - 1 && isWordChar(line[end + 1]))
            end++;
    }
    else {
        // On whitespace or punctuation — select the non-word span
        const isCurrentType = bigWord
            ? () => false
            : (ch) => !WORD_RE.test(ch) && ch !== ' ' && ch !== '\t';
        if (charAtCol === ' ' || charAtCol === '\t') {
            while (start > 0 && (line[start - 1] === ' ' || line[start - 1] === '\t'))
                start--;
            while (end < line.length - 1 && (line[end + 1] === ' ' || line[end + 1] === '\t'))
                end++;
        }
        else {
            while (start > 0 && isCurrentType(line[start - 1]))
                start--;
            while (end < line.length - 1 && isCurrentType(line[end + 1]))
                end++;
        }
    }
    if (scope === 'around') {
        // Include trailing whitespace (or leading if at end of line)
        if (end < line.length - 1) {
            while (end < line.length - 1 && (line[end + 1] === ' ' || line[end + 1] === '\t'))
                end++;
        }
        else {
            while (start > 0 && (line[start - 1] === ' ' || line[start - 1] === '\t'))
                start--;
        }
    }
    return { start, end: end + 1 };
}
// ============================================================================
// Quote objects
// ============================================================================
function resolveQuoteObject(line, col, quote, scope) {
    // Find the enclosing quote pair
    let openIdx = -1;
    let closeIdx = -1;
    // Search backward for opening quote
    for (let i = col; i >= 0; i--) {
        if (line[i] === quote && (i === 0 || line[i - 1] !== '\\')) {
            openIdx = i;
            break;
        }
    }
    if (openIdx === -1) {
        // Try forward — cursor might be before the quoted section
        for (let i = col; i < line.length; i++) {
            if (line[i] === quote && (i === 0 || line[i - 1] !== '\\')) {
                openIdx = i;
                break;
            }
        }
    }
    if (openIdx === -1)
        return null;
    // Search forward for closing quote
    for (let i = openIdx + 1; i < line.length; i++) {
        if (line[i] === quote && line[i - 1] !== '\\') {
            closeIdx = i;
            break;
        }
    }
    if (closeIdx === -1)
        return null;
    // Ensure cursor is within the quote range
    if (col < openIdx || col > closeIdx) {
        // Check if we found a pair that starts after cursor
        if (openIdx > col) {
            // Search for close after this open
            for (let i = openIdx + 1; i < line.length; i++) {
                if (line[i] === quote && line[i - 1] !== '\\') {
                    closeIdx = i;
                    break;
                }
            }
        }
    }
    if (closeIdx === -1)
        return null;
    if (scope === 'inner') {
        return { start: openIdx + 1, end: closeIdx };
    }
    return { start: openIdx, end: closeIdx + 1 };
}
// ============================================================================
// Bracket objects
// ============================================================================
function resolveBracketObject(line, col, open, close, scope) {
    let depth = 0;
    let openIdx = -1;
    // Search backward for matching open bracket
    for (let i = col; i >= 0; i--) {
        if (line[i] === close && i !== col)
            depth++;
        if (line[i] === open) {
            if (depth === 0) {
                openIdx = i;
                break;
            }
            depth--;
        }
    }
    if (openIdx === -1)
        return null;
    // Search forward for matching close bracket
    depth = 0;
    let closeIdx = -1;
    for (let i = openIdx + 1; i < line.length; i++) {
        if (line[i] === open)
            depth++;
        if (line[i] === close) {
            if (depth === 0) {
                closeIdx = i;
                break;
            }
            depth--;
        }
    }
    if (closeIdx === -1)
        return null;
    if (scope === 'inner') {
        return { start: openIdx + 1, end: closeIdx };
    }
    return { start: openIdx, end: closeIdx + 1 };
}
//# sourceMappingURL=textObjects.js.map