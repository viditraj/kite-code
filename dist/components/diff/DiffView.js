import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Stats helper
// ---------------------------------------------------------------------------
export function computeDiffStats(diffs) {
    let additions = 0;
    let deletions = 0;
    for (const diff of diffs) {
        for (const hunk of diff.hunks) {
            for (const line of hunk.lines) {
                if (line.type === 'add') {
                    additions++;
                }
                else if (line.type === 'remove') {
                    deletions++;
                }
            }
        }
    }
    return { additions, deletions, filesChanged: diffs.length };
}
// ---------------------------------------------------------------------------
// parsePatch
// ---------------------------------------------------------------------------
/**
 * Parse unified diff / patch text into structured FileDiff objects.
 *
 * Handles:
 *   - `diff --git a/path b/path` headers
 *   - `--- a/path` / `+++ b/path` pairs (when no `diff --git` is present)
 *   - `@@ -o,ol +n,nl @@` hunk headers
 *   - `+`, `-`, and ` ` prefixed lines
 *   - `Binary files … differ`
 *   - `new file mode`, `deleted file mode`
 *   - `rename from` / `rename to`
 */
export function parsePatch(patchText) {
    const diffs = [];
    const lines = patchText.split('\n');
    let currentDiff = null;
    let currentHunk = null;
    let oldLineNum = 0;
    let newLineNum = 0;
    function pushCurrentDiff() {
        if (currentHunk && currentDiff) {
            currentDiff.hunks.push(currentHunk);
            currentHunk = null;
        }
        if (currentDiff) {
            diffs.push(currentDiff);
            currentDiff = null;
        }
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // -------------------------------------------------------------------
        // diff --git header  →  start a new file diff
        // -------------------------------------------------------------------
        const gitDiffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (gitDiffMatch) {
            pushCurrentDiff();
            currentDiff = {
                filePath: gitDiffMatch[2],
                hunks: [],
            };
            continue;
        }
        // -------------------------------------------------------------------
        // Metadata lines that appear between `diff --git` and the hunks
        // -------------------------------------------------------------------
        if (currentDiff && !currentHunk) {
            if (/^new file mode/.test(line)) {
                currentDiff.isNew = true;
                continue;
            }
            if (/^deleted file mode/.test(line)) {
                currentDiff.isDeleted = true;
                continue;
            }
            if (/^rename from (.+)/.test(line)) {
                const m = line.match(/^rename from (.+)/);
                if (m) {
                    currentDiff.isRenamed = true;
                    currentDiff.oldPath = m[1];
                }
                continue;
            }
            if (/^rename to (.+)/.test(line)) {
                // filePath should already be set from diff --git
                currentDiff.isRenamed = true;
                continue;
            }
            if (/^Binary files/.test(line) || /Binary files .+ differ/.test(line)) {
                currentDiff.isBinary = true;
                continue;
            }
            // Skip index, similarity, old mode, new mode, --- , +++ lines
            if (/^index /.test(line) ||
                /^similarity index/.test(line) ||
                /^old mode/.test(line) ||
                /^new mode/.test(line) ||
                /^--- /.test(line) ||
                /^\+\+\+ /.test(line)) {
                continue;
            }
        }
        // -------------------------------------------------------------------
        // Fallback: --- / +++ pair without a preceding diff --git header
        // -------------------------------------------------------------------
        if (!currentDiff && /^--- /.test(line)) {
            const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
            if (/^\+\+\+ /.test(nextLine)) {
                pushCurrentDiff();
                const filePath = nextLine
                    .replace(/^\+\+\+ /, '')
                    .replace(/^[ab]\//, '');
                currentDiff = { filePath, hunks: [] };
                i++; // skip the +++ line
                continue;
            }
        }
        // -------------------------------------------------------------------
        // Hunk header
        // -------------------------------------------------------------------
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
            // If we don't have a diff yet, create a placeholder one
            if (!currentDiff) {
                currentDiff = { filePath: 'unknown', hunks: [] };
            }
            // Push previous hunk
            if (currentHunk) {
                currentDiff.hunks.push(currentHunk);
            }
            const oldStart = parseInt(hunkMatch[1], 10);
            const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
            const newStart = parseInt(hunkMatch[3], 10);
            const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
            currentHunk = { oldStart, oldLines, newStart, newLines, lines: [] };
            oldLineNum = oldStart;
            newLineNum = newStart;
            continue;
        }
        // -------------------------------------------------------------------
        // Diff content lines (inside a hunk)
        // -------------------------------------------------------------------
        if (currentHunk) {
            if (line.startsWith('+')) {
                currentHunk.lines.push({
                    type: 'add',
                    content: line.slice(1),
                    newLineNumber: newLineNum,
                });
                newLineNum++;
            }
            else if (line.startsWith('-')) {
                currentHunk.lines.push({
                    type: 'remove',
                    content: line.slice(1),
                    oldLineNumber: oldLineNum,
                });
                oldLineNum++;
            }
            else if (line.startsWith(' ') || line === '') {
                currentHunk.lines.push({
                    type: 'context',
                    content: line.startsWith(' ') ? line.slice(1) : line,
                    oldLineNumber: oldLineNum,
                    newLineNumber: newLineNum,
                });
                oldLineNum++;
                newLineNum++;
            }
            else if (line.startsWith('\\')) {
                // "\ No newline at end of file" — skip
                continue;
            }
            else {
                // Non-diff line encountered while in hunk → hunk is over
                if (currentDiff) {
                    currentDiff.hunks.push(currentHunk);
                }
                currentHunk = null;
            }
        }
    }
    // Flush whatever is still in progress
    pushCurrentDiff();
    return diffs;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function padLineNum(num, width) {
    if (num === undefined) {
        return ' '.repeat(width);
    }
    return String(num).padStart(width, ' ');
}
function truncateText(text, maxWidth) {
    if (text.length <= maxWidth) {
        return text;
    }
    return text.slice(0, maxWidth - 1) + '…';
}
function fileStatusLabel(diff) {
    if (diff.isNew)
        return '[new]';
    if (diff.isDeleted)
        return '[deleted]';
    if (diff.isRenamed)
        return '[renamed]';
    return '[modified]';
}
function fileStatusIcon(diff) {
    if (diff.isNew)
        return 'A';
    if (diff.isDeleted)
        return 'D';
    if (diff.isRenamed)
        return 'R';
    return 'M';
}
function fileStatusColor(diff) {
    if (diff.isNew)
        return 'green';
    if (diff.isDeleted)
        return 'red';
    if (diff.isRenamed)
        return 'yellow';
    return 'cyan';
}
function computeLineNumWidth(hunks) {
    let maxLine = 0;
    for (const hunk of hunks) {
        const oldEnd = hunk.oldStart + hunk.oldLines;
        const newEnd = hunk.newStart + hunk.newLines;
        if (oldEnd > maxLine)
            maxLine = oldEnd;
        if (newEnd > maxLine)
            maxLine = newEnd;
    }
    return Math.max(String(maxLine).length, 1);
}
export const DiffLineView = ({ line, showLineNumbers = false, lineNumWidth = 4, maxWidth, }) => {
    const content = maxWidth ? truncateText(line.content, maxWidth) : line.content;
    const w = lineNumWidth;
    if (line.type === 'add') {
        return (_jsxs(Box, { children: [showLineNumbers && (_jsxs(Text, { color: "gray", children: [padLineNum(undefined, w), " ", padLineNum(line.newLineNumber, w), ' '] })), _jsx(Text, { color: "green", backgroundColor: "greenBright", children: "+" }), _jsx(Text, { color: "green", children: content })] }));
    }
    if (line.type === 'remove') {
        return (_jsxs(Box, { children: [showLineNumbers && (_jsxs(Text, { color: "gray", children: [padLineNum(line.oldLineNumber, w), " ", padLineNum(undefined, w), ' '] })), _jsx(Text, { color: "red", backgroundColor: "redBright", children: "-" }), _jsx(Text, { color: "red", children: content })] }));
    }
    // context
    return (_jsxs(Box, { children: [showLineNumbers && (_jsxs(Text, { color: "gray", children: [padLineNum(line.oldLineNumber, w), " ", padLineNum(line.newLineNumber, w), ' '] })), _jsxs(Text, { dimColor: true, children: [" ", content] })] }));
};
export const DiffHunkView = ({ hunk, showLineNumbers = false, lineNumWidth = 4, maxWidth, }) => {
    const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: header }), hunk.lines.map((line, idx) => (_jsx(DiffLineView, { line: line, showLineNumbers: showLineNumbers, lineNumWidth: lineNumWidth, maxWidth: maxWidth }, idx)))] }));
};
export const DiffFileView = ({ diff, showLineNumbers = false, maxWidth, collapsed = false, }) => {
    const stats = useMemo(() => computeDiffStats([diff]), [diff]);
    const statusLabel = fileStatusLabel(diff);
    const statusColor = fileStatusColor(diff);
    const lineNumWidth = useMemo(() => computeLineNumWidth(diff.hunks), [diff.hunks]);
    const displayPath = diff.isRenamed && diff.oldPath
        ? `${diff.oldPath} → ${diff.filePath}`
        : diff.filePath;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: statusColor, bold: true, children: [statusLabel, ' '] }), _jsx(Text, { bold: true, children: displayPath })] }), diff.isBinary && (_jsx(Text, { dimColor: true, italic: true, children: "Binary file (no diff available)" })), !collapsed && !diff.isBinary && (_jsx(Box, { flexDirection: "column", children: diff.hunks.map((hunk, idx) => (_jsx(DiffHunkView, { hunk: hunk, showLineNumbers: showLineNumbers, lineNumWidth: lineNumWidth, maxWidth: maxWidth }, idx))) })), _jsxs(Box, { children: [_jsxs(Text, { color: "green", children: ["+", stats.additions] }), _jsx(Text, { children: " " }), _jsxs(Text, { color: "red", children: ["-", stats.deletions] })] })] }));
};
export const DiffSummary = ({ diffs }) => {
    const stats = useMemo(() => computeDiffStats(diffs), [diffs]);
    return (_jsxs(Box, { flexDirection: "column", children: [diffs.map((diff, idx) => {
                const icon = fileStatusIcon(diff);
                const color = fileStatusColor(diff);
                const displayPath = diff.isRenamed && diff.oldPath
                    ? `${diff.oldPath} → ${diff.filePath}`
                    : diff.filePath;
                return (_jsxs(Box, { children: [_jsxs(Text, { color: color, bold: true, children: [icon, ' '] }), _jsx(Text, { children: displayPath })] }, idx));
            }), _jsxs(Box, { marginTop: 1, children: [_jsxs(Text, { children: [stats.filesChanged, " file", stats.filesChanged !== 1 ? 's' : '', " changed,", ' '] }), _jsxs(Text, { color: "green", children: ["+", stats.additions] }), _jsx(Text, { children: " " }), _jsxs(Text, { color: "red", children: ["-", stats.deletions] })] })] }));
};
export const DiffView = ({ diffs, showLineNumbers = false, maxWidth, showStats = true, }) => {
    const stats = useMemo(() => computeDiffStats(diffs), [diffs]);
    return (_jsxs(Box, { flexDirection: "column", children: [showStats && (_jsxs(Box, { marginBottom: 1, children: [_jsxs(Text, { bold: true, children: [stats.filesChanged, " file", stats.filesChanged !== 1 ? 's' : '', " changed,", ' '] }), _jsxs(Text, { color: "green", bold: true, children: ["+", stats.additions] }), _jsx(Text, { bold: true, children: " " }), _jsxs(Text, { color: "red", bold: true, children: ["-", stats.deletions] })] })), diffs.map((diff, idx) => (_jsxs(Box, { flexDirection: "column", children: [idx > 0 && (_jsx(Box, { marginTop: 1, marginBottom: 1, children: _jsx(Text, { dimColor: true, children: '─'.repeat(40) }) })), _jsx(DiffFileView, { diff: diff, showLineNumbers: showLineNumbers, maxWidth: maxWidth })] }, idx)))] }));
};
//# sourceMappingURL=DiffView.js.map