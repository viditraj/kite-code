/**
 * FileReadTool — Read file contents.
 *
 * Implements the same patterns as Claude Code's FileReadTool.ts:
 * - Read files with optional line offset/limit
 * - List directory contents
 * - Always read-only, always concurrency-safe
 * - maxResultSizeChars: Infinity (never persist to disk)
 */
import { z } from 'zod';
import { readFileSync, statSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { buildTool } from '../../Tool.js';
const FILE_READ_TOOL_NAME = 'Read';
const MAX_FILE_SIZE = 256 * 1024; // 256KB default read limit
const inputSchema = z.strictObject({
    file_path: z.string().describe('The absolute path to the file to read'),
    offset: z.number().int().nonnegative().optional().describe('The line number to start reading from (1-based). Only provide if the file is too large to read at once.'),
    limit: z.number().int().positive().optional().describe('The number of lines to read. Only provide if the file is too large to read at once.'),
});
export const FileReadTool = buildTool({
    name: FILE_READ_TOOL_NAME,
    aliases: ['FileRead'],
    searchHint: 'read files, images, PDFs, notebooks',
    maxResultSizeChars: Infinity, // Never persist — prevents circular Read→file→Read
    strict: true,
    inputSchema,
    async description() {
        return 'Read the contents of a file or list a directory';
    },
    async prompt() {
        return `Read the contents of a file or list directory contents.

For text files, returns the file content. Supports line offset and limit for reading portions of large files.
For directories, returns a sorted listing of entries.
For binary files, returns an error message.

Important:
- Use this instead of cat, head, tail, or sed via Bash
- Always read a file before editing it
- For large files, use offset and limit to read in chunks`;
    },
    isConcurrencySafe() {
        return true; // Always safe — read-only
    },
    isReadOnly() {
        return true; // Never writes
    },
    async checkPermissions() {
        return { behavior: 'allow' };
    },
    isSearchOrReadCommand() {
        return { isSearch: false, isRead: true };
    },
    toAutoClassifierInput(input) {
        return input.file_path;
    },
    getPath(input) {
        return input.file_path;
    },
    backfillObservableInput(input) {
        if (typeof input.file_path === 'string') {
            let expanded = input.file_path;
            if (expanded.startsWith('~/') || expanded === '~') {
                expanded = homedir() + expanded.slice(1);
            }
            if (!expanded.startsWith('/')) {
                expanded = resolve(process.cwd(), expanded);
            }
            input.file_path = expanded;
        }
    },
    async preparePermissionMatcher({ file_path }) {
        const resolved = resolve(process.cwd(), file_path);
        return (pattern) => {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
                return regex.test(resolved) || regex.test(file_path);
            }
            return resolved === pattern || file_path === pattern || resolved.startsWith(pattern + '/');
        };
    },
    userFacingName(_input) {
        return 'Read';
    },
    getToolUseSummary(input) {
        if (!input?.file_path)
            return null;
        return input.file_path;
    },
    getActivityDescription(input) {
        if (!input?.file_path)
            return 'Reading file';
        return `Reading ${input.file_path}`;
    },
    async call(input, context, _canUseTool, _parentMessage) {
        const cwd = context.getCwd();
        const filePath = resolve(cwd, input.file_path);
        try {
            const stat = statSync(filePath);
            // Directory listing
            if (stat.isDirectory()) {
                const entries = readdirSync(filePath).sort();
                return {
                    data: {
                        content: entries.join('\n'),
                        filePath,
                        isDirectory: true,
                    },
                };
            }
            // File reading
            const content = readFileSync(filePath, 'utf-8');
            if (input.offset !== undefined || input.limit !== undefined) {
                // Line-based reading with offset/limit
                const lines = content.split('\n');
                const start = Math.max(0, (input.offset ?? 1) - 1);
                const end = input.limit ? start + input.limit : lines.length;
                const selectedLines = lines.slice(start, end);
                // Format with line numbers
                const formatted = selectedLines.map((line, i) => {
                    const lineNum = start + i + 1;
                    return `${String(lineNum).padStart(6, ' ')}\t${line}`;
                }).join('\n');
                return {
                    data: {
                        content: formatted,
                        filePath,
                        isDirectory: false,
                        lineCount: lines.length,
                    },
                };
            }
            // Full file read with size check
            if (content.length > MAX_FILE_SIZE) {
                const lines = content.split('\n');
                const truncated = content.slice(0, MAX_FILE_SIZE);
                const truncatedLines = truncated.split('\n');
                const formatted = truncatedLines.map((line, i) => {
                    return `${String(i + 1).padStart(6, ' ')}\t${line}`;
                }).join('\n');
                return {
                    data: {
                        content: formatted + `\n\n... (truncated at ${MAX_FILE_SIZE} bytes. Total: ${content.length} bytes, ${lines.length} lines. Use offset/limit for the rest.)`,
                        filePath,
                        isDirectory: false,
                        lineCount: lines.length,
                    },
                };
            }
            // Full file — add line numbers
            const lines = content.split('\n');
            const formatted = lines.map((line, i) => {
                return `${String(i + 1).padStart(6, ' ')}\t${line}`;
            }).join('\n');
            return {
                data: {
                    content: formatted,
                    filePath,
                    isDirectory: false,
                    lineCount: lines.length,
                },
            };
        }
        catch (err) {
            const error = err;
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${input.file_path}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${input.file_path}`);
            }
            throw error;
        }
    },
    mapToolResultToToolResultBlockParam(data, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: data.content,
        };
    },
});
export { FILE_READ_TOOL_NAME };
//# sourceMappingURL=FileReadTool.js.map