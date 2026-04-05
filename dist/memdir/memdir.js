/**
 * Memory system for session and project memory.
 *
 * Provides reading/writing of MEMORY.md files, daily logs,
 * memory prompt construction, and scanning for project memory
 * files (AGENTS.md, CLAUDE.md, MEMORY.md) across the directory hierarchy.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getAutoMemEntrypoint, isAutoMemoryEnabled, getAutoMemDailyLogPath } from './paths.js';
// ============================================================================
// Constants
// ============================================================================
export const ENTRYPOINT_NAME = 'MEMORY.md';
export const MAX_ENTRYPOINT_LINES = 200;
export const MAX_ENTRYPOINT_BYTES = 25_000;
// ============================================================================
// Memory types prompt sections
// ============================================================================
export const MEMORY_TYPES_SECTION = `## Types of Memories to Save
- User preferences and workflow patterns
- Project architecture and key design decisions
- Important file locations and their purposes
- Common commands and build processes
- Code conventions and naming patterns
- Known issues and their workarounds`;
export const WHEN_TO_ACCESS_SECTION = `## When to Access Memories
- At the start of a new conversation
- When working on a task related to stored knowledge
- When the user asks about project structure or conventions`;
export const WHAT_NOT_TO_SAVE_SECTION = `## What NOT to Save
- Temporary or one-time information
- Sensitive data (API keys, passwords, tokens)
- Information that changes frequently
- Exact code snippets (save descriptions/locations instead)`;
// ============================================================================
// Truncation
// ============================================================================
/**
 * Truncate MEMORY.md content to line AND byte caps.
 *
 * - Trims input, splits by newlines
 * - If lines exceed MAX_ENTRYPOINT_LINES, truncate to that many lines
 * - If byte size exceeds MAX_ENTRYPOINT_BYTES, truncate at the last newline
 *   before the cap
 * - Appends a warning footer indicating the reason (line count, byte size,
 *   or both)
 * - Returns the (possibly truncated) content plus metadata
 */
export function truncateEntrypointContent(raw) {
    const trimmed = raw.trim();
    const allLines = trimmed.split('\n');
    const originalLineCount = allLines.length;
    const originalByteCount = Buffer.byteLength(trimmed, 'utf-8');
    let wasLineTruncated = false;
    let wasByteTruncated = false;
    let lines = allLines;
    // Step 1: Truncate by line count
    if (lines.length > MAX_ENTRYPOINT_LINES) {
        lines = lines.slice(0, MAX_ENTRYPOINT_LINES);
        wasLineTruncated = true;
    }
    // Step 2: Truncate by byte count
    let content = lines.join('\n');
    let byteCount = Buffer.byteLength(content, 'utf-8');
    if (byteCount > MAX_ENTRYPOINT_BYTES) {
        wasByteTruncated = true;
        // Find the last newline position that fits within the byte budget
        // We work backwards through lines to find the cutoff
        while (byteCount > MAX_ENTRYPOINT_BYTES && lines.length > 0) {
            lines.pop();
            content = lines.join('\n');
            byteCount = Buffer.byteLength(content, 'utf-8');
        }
    }
    // Step 3: Append warning if truncated
    if (wasLineTruncated || wasByteTruncated) {
        const reasons = [];
        if (wasLineTruncated) {
            reasons.push(`line count exceeded ${MAX_ENTRYPOINT_LINES} (was ${originalLineCount})`);
        }
        if (wasByteTruncated) {
            reasons.push(`byte size exceeded ${MAX_ENTRYPOINT_BYTES} (was ${originalByteCount})`);
        }
        const warning = `\n\n<!-- TRUNCATED: ${reasons.join(' and ')} -->`;
        content = content + warning;
    }
    const finalByteCount = Buffer.byteLength(content, 'utf-8');
    const finalLineCount = content.split('\n').length;
    return {
        content,
        lineCount: finalLineCount,
        byteCount: finalByteCount,
        wasLineTruncated,
        wasByteTruncated,
    };
}
// ============================================================================
// Memory file I/O
// ============================================================================
/**
 * Read MEMORY.md from the auto-memory directory.
 *
 * Returns the file contents as a string, or null if auto-memory is disabled
 * or the file does not exist.
 */
export function readMemoryFile(projectRoot) {
    if (!isAutoMemoryEnabled()) {
        return null;
    }
    const entrypoint = getAutoMemEntrypoint(projectRoot);
    if (!existsSync(entrypoint)) {
        return null;
    }
    try {
        return readFileSync(entrypoint, 'utf-8');
    }
    catch {
        return null;
    }
}
/**
 * Write content to MEMORY.md in the auto-memory directory.
 *
 * Creates the directory tree as needed.
 */
export function writeMemoryFile(content, projectRoot) {
    const entrypoint = getAutoMemEntrypoint(projectRoot);
    const dir = dirname(entrypoint);
    mkdirSync(dir, { recursive: true });
    writeFileSync(entrypoint, content, 'utf-8');
}
/**
 * Append content to the existing MEMORY.md, creating the file if it does
 * not yet exist.
 */
export function appendToMemoryFile(content, projectRoot) {
    const existing = readMemoryFile(projectRoot);
    if (existing !== null) {
        writeMemoryFile(existing + '\n' + content, projectRoot);
    }
    else {
        writeMemoryFile(content, projectRoot);
    }
}
// ============================================================================
// Daily log I/O
// ============================================================================
/**
 * Format a Date as YYYY-MM-DD for daily log filenames.
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/**
 * Append content to the daily log file (YYYY-MM-DD.md).
 *
 * Creates directories as needed. Uses today's date when none is provided.
 */
export function appendToDailyLog(content, date) {
    const effectiveDate = date ?? new Date();
    const dateStr = formatDate(effectiveDate);
    const logPath = getAutoMemDailyLogPath(effectiveDate);
    const dir = dirname(logPath);
    mkdirSync(dir, { recursive: true });
    let existing = '';
    if (existsSync(logPath)) {
        try {
            existing = readFileSync(logPath, 'utf-8');
        }
        catch {
            existing = '';
        }
    }
    const separator = existing.length > 0 ? '\n' : '';
    writeFileSync(logPath, existing + separator + content, 'utf-8');
}
/**
 * Read the daily log for the given date.
 *
 * Returns the file contents, or null if the log does not exist.
 * Uses today's date when none is provided.
 */
export function readDailyLog(date) {
    const effectiveDate = date ?? new Date();
    const logPath = getAutoMemDailyLogPath(effectiveDate);
    if (!existsSync(logPath)) {
        return null;
    }
    try {
        return readFileSync(logPath, 'utf-8');
    }
    catch {
        return null;
    }
}
// ============================================================================
// Prompt building
// ============================================================================
/**
 * Build the memory section for the system prompt.
 *
 * - Reads MEMORY.md from the auto-memory directory
 * - Truncates if the file exceeds line or byte caps
 * - Wraps the content in instructional context about the memory format
 * - Includes guidance on when and what to save
 * - Returns a formatted prompt section, or an empty string if auto-memory
 *   is disabled or no memories exist
 */
export function buildMemoryPrompt(projectRoot) {
    if (!isAutoMemoryEnabled()) {
        return '';
    }
    const raw = readMemoryFile(projectRoot);
    if (raw === null || raw.trim().length === 0) {
        return '';
    }
    const truncation = truncateEntrypointContent(raw);
    const parts = [
        '<memory>',
        '# Project Memory (MEMORY.md)',
        '',
        'The following memories were saved from previous sessions.',
        'Use them to maintain context across conversations.',
        '',
        truncation.content,
        '',
        '---',
        '',
        MEMORY_TYPES_SECTION,
        '',
        WHEN_TO_ACCESS_SECTION,
        '',
        WHAT_NOT_TO_SAVE_SECTION,
        '',
        '## Saving Memories',
        'When you learn important information about the project or user preferences,',
        'save it to MEMORY.md so it persists across sessions. Use the memory tools',
        'or write directly to the memory file. Keep entries concise and organized.',
        'Group related memories under markdown headings.',
        '</memory>',
    ];
    return parts.join('\n');
}
// ============================================================================
// Memory file scanning
// ============================================================================
/**
 * Scan for all memory files (AGENTS.md, CLAUDE.md, MEMORY.md) in the
 * project hierarchy.
 *
 * The scan works as follows:
 * 1. Walk from `cwd` up to the user's home directory, checking each
 *    directory for AGENTS.md and CLAUDE.md.
 * 2. Check `~/.kite/` for a global AGENTS.md.
 * 3. Include MEMORY.md from the auto-memory directory (if it exists and
 *    auto-memory is enabled).
 *
 * Returns an array of objects with `path`, `content`, and `source` fields.
 * The `source` field indicates where the file was found (e.g. "project",
 * "ancestor", "global", "auto-memory").
 */
export function getMemoryFiles(cwd) {
    const results = [];
    const seen = new Set();
    // Determine the home directory for the upward walk boundary
    const home = process.env.HOME || process.env.USERPROFILE || '/';
    // Helper to read a file and push to results if it exists and hasn't been seen
    function tryAdd(filePath, source) {
        if (seen.has(filePath))
            return;
        if (!existsSync(filePath))
            return;
        try {
            const content = readFileSync(filePath, 'utf-8');
            seen.add(filePath);
            results.push({ path: filePath, content, source });
        }
        catch {
            // skip unreadable files
        }
    }
    // Step 1: Walk from cwd up to home, checking for AGENTS.md and CLAUDE.md
    let current = cwd;
    let isFirst = true;
    while (true) {
        const source = isFirst ? 'project' : 'ancestor';
        tryAdd(join(current, 'AGENTS.md'), source);
        tryAdd(join(current, 'CLAUDE.md'), source);
        isFirst = false;
        // Stop if we've reached or passed home
        if (current === home || current === '/' || current === dirname(current)) {
            break;
        }
        const parent = dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    // Step 2: Check ~/.kite/ for global AGENTS.md
    const globalAgents = join(home, '.kite', 'AGENTS.md');
    tryAdd(globalAgents, 'global');
    // Step 3: Include MEMORY.md from auto-memory directory
    if (isAutoMemoryEnabled()) {
        const memoryContent = readMemoryFile();
        if (memoryContent !== null) {
            const memoryPath = getAutoMemEntrypoint();
            if (!seen.has(memoryPath)) {
                seen.add(memoryPath);
                results.push({ path: memoryPath, content: memoryContent, source: 'auto-memory' });
            }
        }
    }
    return results;
}
//# sourceMappingURL=memdir.js.map