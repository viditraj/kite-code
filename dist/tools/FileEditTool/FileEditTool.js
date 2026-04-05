/**
 * FileEditTool — Edit files with exact string replacement.
 *
 * Implements the same patterns as Claude Code's FileEditTool.ts:
 * - Exact string replacement (old_string → new_string)
 * - Optional replace_all for multiple occurrences
 * - Validates uniqueness of old_string
 * - Not concurrency-safe, not read-only
 */
import { z } from 'zod';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { buildTool } from '../../Tool.js';
import { backupFileBeforeEdit } from '../../utils/fileHistory.js';
const FILE_EDIT_TOOL_NAME = 'Edit';
const inputSchema = z.strictObject({
    file_path: z.string().describe('The absolute path to the file to modify'),
    old_string: z.string().describe('The text to replace'),
    new_string: z.string().describe('The text to replace it with (must be different from old_string)'),
    replace_all: z.boolean().default(false).optional().describe('Replace all occurrences of old_string (default false)'),
});
export const FileEditTool = buildTool({
    name: FILE_EDIT_TOOL_NAME,
    aliases: ['FileEdit'],
    searchHint: 'modify file contents in place',
    maxResultSizeChars: 100_000,
    strict: true,
    inputSchema,
    async description() {
        return 'Edit a file by replacing exact string matches';
    },
    async prompt() {
        return `Perform exact string replacements in files.

Usage:
- The old_string must match EXACTLY (including whitespace and indentation)
- The old_string must be unique in the file unless replace_all is true
- The new_string must be different from old_string
- Always read a file before editing to understand its content
- Preserve the exact indentation style of the file`;
    },
    toAutoClassifierInput(input) {
        return `${input.file_path}: ${input.new_string}`;
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
        return 'Edit';
    },
    getToolUseSummary(input) {
        if (!input?.file_path)
            return null;
        return input.file_path;
    },
    getActivityDescription(input) {
        if (!input?.file_path)
            return 'Editing file';
        return `Editing ${input.file_path}`;
    },
    async validateInput(input) {
        if (input.old_string === input.new_string) {
            return {
                result: false,
                message: 'No changes to make: old_string and new_string are exactly the same.',
                errorCode: 1,
            };
        }
        return { result: true };
    },
    async call(input, context, _canUseTool, _parentMessage) {
        const cwd = context.getCwd();
        const filePath = resolve(cwd, input.file_path);
        const replaceAll = input.replace_all ?? false;
        // Backup before editing
        backupFileBeforeEdit(filePath);
        const content = readFileSync(filePath, 'utf-8');
        const count = content.split(input.old_string).length - 1;
        if (count === 0) {
            throw new Error(`old_string not found in ${input.file_path}. Make sure it matches exactly, ` +
                `including whitespace and indentation. Use the Read tool first to see the file content.`);
        }
        if (count > 1 && !replaceAll) {
            throw new Error(`old_string found ${count} times in ${input.file_path}. ` +
                `Use replace_all=true to replace all occurrences, or provide more surrounding ` +
                `context in old_string to make it unique.`);
        }
        const newContent = replaceAll
            ? content.replaceAll(input.old_string, input.new_string)
            : content.replace(input.old_string, input.new_string);
        writeFileSync(filePath, newContent, 'utf-8');
        const replacements = replaceAll ? count : 1;
        return {
            data: {
                filePath,
                replacements,
            },
        };
    },
    mapToolResultToToolResultBlockParam(data, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: `Replaced ${data.replacements} occurrence(s) in ${data.filePath}`,
        };
    },
});
export { FILE_EDIT_TOOL_NAME };
//# sourceMappingURL=FileEditTool.js.map