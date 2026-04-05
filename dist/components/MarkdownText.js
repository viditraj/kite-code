import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
// ============================================================================
// Basic syntax highlighting for code lines
// ============================================================================
// Keywords by language family
const JS_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete|true|false|null|undefined)\b/g;
const PY_KEYWORDS = /\b(def|class|return|if|elif|else|for|while|with|as|import|from|try|except|finally|raise|pass|break|continue|yield|lambda|and|or|not|in|is|True|False|None|self|async|await|print)\b/g;
const RUST_KEYWORDS = /\b(fn|let|mut|const|if|else|for|while|loop|match|return|use|mod|pub|struct|enum|impl|trait|type|where|async|await|self|Self|true|false|move|ref|unsafe)\b/g;
const STRING_PATTERN = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;
const COMMENT_PATTERN = /(\/\/.*$|#.*$)/gm;
const NUMBER_PATTERN = /\b(\d+\.?\d*)\b/g;
const CodeLine = ({ line, lang }) => {
    if (!lang || !line.trim())
        return _jsx(_Fragment, { children: line });
    const keywords = ['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(lang) ? JS_KEYWORDS
        : ['py', 'python'].includes(lang) ? PY_KEYWORDS
            : ['rs', 'rust'].includes(lang) ? RUST_KEYWORDS
                : null;
    if (!keywords)
        return _jsx(_Fragment, { children: line });
    // Simple approach: split line into tokens and colorize
    const parts = [];
    let remaining = line;
    let key = 0;
    // Check for comments first (they take precedence)
    const commentMatch = remaining.match(/^(\s*)(\/\/.*|#.*)$/);
    if (commentMatch) {
        return _jsxs(_Fragment, { children: [_jsx(Text, { children: commentMatch[1] }), _jsx(Text, { color: "gray", italic: true, children: commentMatch[2] })] });
    }
    // Process string literals
    const stringRegex = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;
    let lastIdx = 0;
    let match;
    while ((match = stringRegex.exec(remaining)) !== null) {
        // Text before string
        if (match.index > lastIdx) {
            const before = remaining.slice(lastIdx, match.index);
            parts.push(_jsx(HighlightKeywords, { text: before, keywords: keywords }, key++));
        }
        // The string literal
        parts.push(_jsx(Text, { color: "green", children: match[0] }, key++));
        lastIdx = match.index + match[0].length;
    }
    // Remaining text after last string
    if (lastIdx < remaining.length) {
        parts.push(_jsx(HighlightKeywords, { text: remaining.slice(lastIdx), keywords: keywords }, key++));
    }
    if (parts.length === 0) {
        return _jsx(HighlightKeywords, { text: line, keywords: keywords });
    }
    return _jsx(_Fragment, { children: parts });
};
const HighlightKeywords = ({ text, keywords }) => {
    // Reset regex lastIndex
    keywords.lastIndex = 0;
    const parts = [];
    let lastIdx = 0;
    let match;
    let key = 0;
    while ((match = keywords.exec(text)) !== null) {
        if (match.index > lastIdx) {
            parts.push(_jsx(Text, { children: text.slice(lastIdx, match.index) }, key++));
        }
        parts.push(_jsx(Text, { color: "magenta", bold: true, children: match[0] }, key++));
        lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
        parts.push(_jsx(Text, { children: text.slice(lastIdx) }, key++));
    }
    if (parts.length === 0)
        return _jsx(Text, { children: text });
    return _jsx(_Fragment, { children: parts });
};
/**
 * Render a string with basic markdown formatting.
 * Handles inline formatting and block-level elements.
 */
export const MarkdownText = ({ children }) => {
    const lines = children.split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // Fenced code block
        if (line.trimStart().startsWith('```')) {
            const lang = line.trimStart().slice(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            // Calculate box width based on longest code line (+ 4 for border + padding)
            const maxLineLen = codeLines.reduce((max, l) => Math.max(max, l.length), 0);
            const boxWidth = Math.min(maxLineLen + 4, 80);
            blocks.push(_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [lang && _jsxs(Text, { dimColor: true, children: [" ", lang] }), _jsx(Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, flexDirection: "column", width: boxWidth, children: codeLines.map((cl, ci) => (_jsx(Text, { children: _jsx(CodeLine, { line: cl, lang: lang }) }, ci))) })] }, `code-${blocks.length}`));
            continue;
        }
        // Heading
        if (line.startsWith('# ')) {
            blocks.push(_jsx(Text, { bold: true, underline: true, children: '\n' + line.slice(2) }, `h-${blocks.length}`));
            i++;
            continue;
        }
        if (line.startsWith('## ')) {
            blocks.push(_jsx(Text, { bold: true, children: '\n' + line.slice(3) }, `h2-${blocks.length}`));
            i++;
            continue;
        }
        if (line.startsWith('### ')) {
            blocks.push(_jsx(Text, { bold: true, children: line.slice(4) }, `h3-${blocks.length}`));
            i++;
            continue;
        }
        // Bullet list
        if (/^\s*[-*]\s/.test(line)) {
            const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
            const content = line.replace(/^\s*[-*]\s+/, '');
            blocks.push(_jsxs(Box, { marginLeft: indent, children: [_jsx(Text, { color: "cyan", children: '\u2022 ' }), _jsx(InlineMarkdown, { text: content })] }, `li-${blocks.length}`));
            i++;
            continue;
        }
        // Numbered list
        if (/^\s*\d+\.\s/.test(line)) {
            const match = line.match(/^(\s*)(\d+)\.\s+(.*)/);
            if (match) {
                const indent = match[1]?.length ?? 0;
                blocks.push(_jsxs(Box, { marginLeft: indent, children: [_jsxs(Text, { dimColor: true, children: [match[2], ". "] }), _jsx(InlineMarkdown, { text: match[3] })] }, `ol-${blocks.length}`));
            }
            i++;
            continue;
        }
        // Markdown table — lines starting with |
        if (line.trimStart().startsWith('|') && line.trimEnd().endsWith('|')) {
            const tableRows = [];
            let hasHeader = false;
            while (i < lines.length) {
                const tl = lines[i].trim();
                if (!tl.startsWith('|') || !tl.endsWith('|'))
                    break;
                if (/^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(tl)) {
                    hasHeader = true;
                    i++;
                    continue;
                }
                const cells = tl.split('|').slice(1, -1).map(c => c.trim());
                tableRows.push(cells);
                i++;
            }
            if (tableRows.length > 0) {
                const colCount = Math.max(...tableRows.map(r => r.length));
                // Calculate ideal widths from content
                const idealWidths = Array.from({ length: colCount }, (_, ci) => Math.max(...tableRows.map(r => (r[ci] ?? '').length), 3));
                // Available width: terminal (approx 78) minus borders overhead
                // Each column needs: 1 border + 1 space + content + 1 space = content + 3
                // Plus 1 for the leading border
                const maxTableWidth = 76; // safe default
                const borderOverhead = 1 + colCount * 3;
                const availableForContent = maxTableWidth - borderOverhead;
                // If total ideal fits, use ideal. Otherwise shrink proportionally.
                const totalIdeal = idealWidths.reduce((s, w) => s + w, 0);
                let colWidths;
                if (totalIdeal <= availableForContent) {
                    colWidths = idealWidths;
                }
                else {
                    // Shrink proportionally, with minimum of 5 chars per column
                    const scale = availableForContent / totalIdeal;
                    colWidths = idealWidths.map(w => Math.max(Math.floor(w * scale), 5));
                    // If still too wide after proportional shrink, truncate further
                    const totalAfterScale = colWidths.reduce((s, w) => s + w, 0);
                    if (totalAfterScale > availableForContent) {
                        const excess = totalAfterScale - availableForContent;
                        // Shave from the widest column
                        const widestIdx = colWidths.indexOf(Math.max(...colWidths));
                        colWidths[widestIdx] = Math.max(colWidths[widestIdx] - excess, 5);
                    }
                }
                const headerRow = hasHeader ? tableRows[0] : null;
                const dataRows = hasHeader ? tableRows.slice(1) : tableRows;
                // Truncate a cell to fit its column width
                function fitCell(text, width) {
                    if (text.length <= width)
                        return text.padEnd(width);
                    return text.slice(0, width - 1) + '\u2026'; // ellipsis
                }
                // Build box-drawing border line
                function borderLine(type) {
                    const [l, m, x, r] = type === 'top' ? ['\u250C', '\u2500', '\u252C', '\u2510']
                        : type === 'mid' ? ['\u251C', '\u2500', '\u253C', '\u2524']
                            : ['\u2514', '\u2500', '\u2534', '\u2518'];
                    return l + colWidths.map(w => m.repeat(w + 2)).join(x) + r;
                }
                // Build data row
                function dataLine(cells) {
                    return '\u2502' + Array.from({ length: colCount }, (_, ci) => {
                        return ' ' + fitCell(cells[ci] ?? '', colWidths[ci]) + ' ';
                    }).join('\u2502') + '\u2502';
                }
                const tableLines = [];
                tableLines.push(borderLine('top'));
                if (headerRow) {
                    tableLines.push(dataLine(headerRow));
                    tableLines.push(borderLine('mid'));
                }
                dataRows.forEach((row, ri) => {
                    tableLines.push(dataLine(row));
                    if (ri < dataRows.length - 1) {
                        tableLines.push(borderLine('mid'));
                    }
                });
                tableLines.push(borderLine('bot'));
                const headerLineIdx = headerRow ? 1 : -1;
                blocks.push(_jsx(Box, { flexDirection: "column", marginTop: 1, children: tableLines.map((tl, ti) => {
                        const isBorder = tl.startsWith('\u250C') || tl.startsWith('\u251C') || tl.startsWith('\u2514');
                        const isHeaderContent = ti === headerLineIdx;
                        return (_jsx(Text, { dimColor: isBorder, bold: isHeaderContent, children: tl }, ti));
                    }) }, `tbl-${blocks.length}`));
            }
            continue;
        }
        // Empty line
        if (line.trim() === '') {
            blocks.push(_jsx(Text, { children: ' ' }, `br-${blocks.length}`));
            i++;
            continue;
        }
        // Regular paragraph with inline formatting
        blocks.push(_jsx(Box, { children: _jsx(InlineMarkdown, { text: line }) }, `p-${blocks.length}`));
        i++;
    }
    return _jsx(Box, { flexDirection: "column", children: blocks });
};
/**
 * Render inline markdown: **bold**, *italic*, `code`, [links](url)
 */
const InlineMarkdown = ({ text }) => {
    const parts = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
        // Bold: **text**
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
            parts.push(_jsx(Text, { bold: true, children: boldMatch[1] }, key++));
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }
        // Italic: *text*
        const italicMatch = remaining.match(/^\*(.+?)\*/);
        if (italicMatch) {
            parts.push(_jsx(Text, { italic: true, children: italicMatch[1] }, key++));
            remaining = remaining.slice(italicMatch[0].length);
            continue;
        }
        // Inline code: `text`
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            parts.push(_jsx(Text, { color: "cyan", children: codeMatch[1] }, key++));
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }
        // Link: [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            parts.push(_jsxs(Text, { children: [_jsx(Text, { bold: true, children: linkMatch[1] }), _jsxs(Text, { dimColor: true, children: [" (", linkMatch[2], ")"] })] }, key++));
            remaining = remaining.slice(linkMatch[0].length);
            continue;
        }
        // Regular text: consume until next special char
        const nextSpecial = remaining.search(/[*`\[]/);
        if (nextSpecial === -1) {
            parts.push(_jsx(Text, { children: remaining }, key++));
            break;
        }
        if (nextSpecial === 0) {
            // The special char didn't match any pattern, consume it
            parts.push(_jsx(Text, { children: remaining[0] }, key++));
            remaining = remaining.slice(1);
        }
        else {
            parts.push(_jsx(Text, { children: remaining.slice(0, nextSpecial) }, key++));
            remaining = remaining.slice(nextSpecial);
        }
    }
    return _jsx(Text, { children: parts });
};
export default MarkdownText;
//# sourceMappingURL=MarkdownText.js.map