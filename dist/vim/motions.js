/**
 * Vim motion resolution.
 *
 * Maps motion keys to cursor movement functions.
 * Implements the same motions as Claude Code's vim/motions.ts.
 */
/**
 * Resolve a motion key to a cursor movement.
 */
export function resolveMotion(key, buffer, count) {
    const { lines, cursor } = buffer;
    const line = lines[cursor.line] ?? '';
    switch (key) {
        // Basic movement
        case 'h':
            return { newCursor: { line: cursor.line, col: Math.max(0, cursor.col - count) }, linewise: false };
        case 'l':
            return { newCursor: { line: cursor.line, col: Math.min(line.length - 1, cursor.col + count) }, linewise: false };
        case 'j':
            return { newCursor: { line: Math.min(lines.length - 1, cursor.line + count), col: cursor.col }, linewise: true };
        case 'k':
            return { newCursor: { line: Math.max(0, cursor.line - count), col: cursor.col }, linewise: true };
        // Word motions
        case 'w':
            return moveWord(buffer, count, 'forward', false);
        case 'W':
            return moveWord(buffer, count, 'forward', true);
        case 'b':
            return moveWord(buffer, count, 'backward', false);
        case 'B':
            return moveWord(buffer, count, 'backward', true);
        case 'e':
            return moveWordEnd(buffer, count, false);
        case 'E':
            return moveWordEnd(buffer, count, true);
        // Line positions
        case '0':
            return { newCursor: { line: cursor.line, col: 0 }, linewise: false };
        case '^': {
            const firstNonBlank = line.search(/\S/);
            return { newCursor: { line: cursor.line, col: firstNonBlank >= 0 ? firstNonBlank : 0 }, linewise: false };
        }
        case '$':
            return { newCursor: { line: cursor.line, col: Math.max(0, line.length - 1) }, linewise: false };
        default:
            return null;
    }
}
// ============================================================================
// Word motion helpers
// ============================================================================
const WORD_CHARS = /[a-zA-Z0-9_]/;
function isWordChar(ch) {
    return WORD_CHARS.test(ch);
}
function isWhitespace(ch) {
    return ch === ' ' || ch === '\t';
}
function moveWord(buf, count, dir, bigWord) {
    let { line, col } = buf.cursor;
    const lines = buf.lines;
    for (let i = 0; i < count; i++) {
        if (dir === 'forward') {
            const currentLine = lines[line] ?? '';
            // Skip current word
            if (bigWord) {
                while (col < currentLine.length && !isWhitespace(currentLine[col]))
                    col++;
            }
            else {
                const startIsWord = col < currentLine.length && isWordChar(currentLine[col]);
                while (col < currentLine.length && (startIsWord ? isWordChar(currentLine[col]) : !isWordChar(currentLine[col]) && !isWhitespace(currentLine[col])))
                    col++;
            }
            // Skip whitespace
            while (col < currentLine.length && isWhitespace(currentLine[col]))
                col++;
            // Move to next line if at end
            if (col >= currentLine.length && line < lines.length - 1) {
                line++;
                col = 0;
                const nextLine = lines[line] ?? '';
                while (col < nextLine.length && isWhitespace(nextLine[col]))
                    col++;
            }
        }
        else {
            // backward
            if (col === 0 && line > 0) {
                line--;
                col = (lines[line] ?? '').length - 1;
            }
            const currentLine = lines[line] ?? '';
            if (col > 0)
                col--;
            // Skip whitespace backward
            while (col > 0 && isWhitespace(currentLine[col]))
                col--;
            // Skip word backward
            if (bigWord) {
                while (col > 0 && !isWhitespace(currentLine[col - 1]))
                    col--;
            }
            else {
                const endIsWord = isWordChar(currentLine[col]);
                while (col > 0 && (endIsWord ? isWordChar(currentLine[col - 1]) : !isWordChar(currentLine[col - 1]) && !isWhitespace(currentLine[col - 1])))
                    col--;
            }
        }
    }
    return { newCursor: { line, col: Math.max(0, col) }, linewise: false };
}
function moveWordEnd(buf, count, bigWord) {
    let { line, col } = buf.cursor;
    const lines = buf.lines;
    for (let i = 0; i < count; i++) {
        const currentLine = lines[line] ?? '';
        if (col < currentLine.length - 1)
            col++;
        // Skip whitespace
        while (col < currentLine.length && isWhitespace(currentLine[col])) {
            col++;
            if (col >= currentLine.length && line < lines.length - 1) {
                line++;
                col = 0;
            }
        }
        const lineNow = lines[line] ?? '';
        // Move to end of word
        if (bigWord) {
            while (col < lineNow.length - 1 && !isWhitespace(lineNow[col + 1]))
                col++;
        }
        else {
            const isWord = isWordChar(lineNow[col]);
            while (col < lineNow.length - 1 && (isWord ? isWordChar(lineNow[col + 1]) : !isWordChar(lineNow[col + 1]) && !isWhitespace(lineNow[col + 1])))
                col++;
        }
    }
    return { newCursor: { line, col: Math.max(0, col) }, linewise: false };
}
//# sourceMappingURL=motions.js.map