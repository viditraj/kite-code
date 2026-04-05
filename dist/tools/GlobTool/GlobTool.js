/**
 * GlobTool — Find files by name pattern.
 *
 * Implements the same patterns as Claude Code's GlobTool.ts:
 * - Uses find command with -name flag
 * - Always read-only, always concurrency-safe
 */
import { z } from 'zod';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { buildTool } from '../../Tool.js';
const GLOB_TOOL_NAME = 'Glob';
const MAX_RESULTS = 200;
const inputSchema = z.strictObject({
    pattern: z.string().describe('The glob pattern to match files against'),
    path: z.string().optional().describe('The directory to search in. Defaults to current working directory. ' +
        'IMPORTANT: Omit this field to use the default. DO NOT enter "undefined" or "null".'),
});
export const GlobTool = buildTool({
    name: GLOB_TOOL_NAME,
    searchHint: 'find files by name pattern or wildcard',
    maxResultSizeChars: 100_000,
    inputSchema,
    async description() {
        return 'Find files matching a glob pattern';
    },
    async prompt() {
        return `Find files by name pattern using glob matching.

Use this instead of find or ls via Bash. Supports standard glob patterns:
- *.js — all JavaScript files
- **/*.ts — TypeScript files in all subdirectories
- src/**/*.{ts,tsx} — TS/TSX files under src/
- test_*.py — Python files starting with test_`;
    },
    isConcurrencySafe() {
        return true;
    },
    isReadOnly() {
        return true;
    },
    async checkPermissions() {
        return { behavior: 'allow' };
    },
    isSearchOrReadCommand() {
        return { isSearch: true, isRead: false, isList: true };
    },
    toAutoClassifierInput(input) {
        return `glob ${input.pattern} ${input.path || '.'}`;
    },
    userFacingName() {
        return 'Glob';
    },
    getToolUseSummary(input) {
        if (!input?.pattern)
            return null;
        return `pattern="${input.pattern}"`;
    },
    getActivityDescription(input) {
        if (!input?.pattern)
            return 'Finding files';
        return `Finding ${input.pattern}`;
    },
    async call(input, context, _canUseTool, _parentMessage) {
        const cwd = context.getCwd();
        const searchPath = input.path ? resolve(cwd, input.path) : cwd;
        try {
            // Use find with -name for glob matching
            const cmd = `find ${JSON.stringify(searchPath)} -name ${JSON.stringify(input.pattern)} -type f 2>/dev/null | head -${MAX_RESULTS + 1}`;
            const output = execSync(cmd, {
                encoding: 'utf-8',
                cwd,
                timeout: 30_000,
                maxBuffer: 5 * 1024 * 1024,
            });
            const files = output.trim().split('\n').filter(Boolean);
            const truncated = files.length > MAX_RESULTS;
            const resultFiles = truncated ? files.slice(0, MAX_RESULTS) : files;
            return {
                data: {
                    files: resultFiles,
                    totalCount: resultFiles.length,
                    truncated,
                },
            };
        }
        catch {
            return {
                data: {
                    files: [],
                    totalCount: 0,
                    truncated: false,
                },
            };
        }
    },
    mapToolResultToToolResultBlockParam(data, toolUseID) {
        if (data.files.length === 0) {
            return {
                type: 'tool_result',
                tool_use_id: toolUseID,
                content: 'No files found.',
            };
        }
        let content = data.files.join('\n');
        if (data.truncated) {
            content += `\n\n... (truncated at ${MAX_RESULTS} results)`;
        }
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content,
        };
    },
});
export { GLOB_TOOL_NAME };
//# sourceMappingURL=GlobTool.js.map