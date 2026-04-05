/**
 * PowerShellTool — Execute PowerShell commands on Windows.
 *
 * Uses child_process.execSync with powershell.exe -Command prefix.
 * On non-Windows platforms, returns an error message.
 * Includes timeout, output truncation, and permission matching.
 */
import { z } from 'zod';
import { execSync } from 'child_process';
import { buildTool } from '../../Tool.js';
import { platform } from 'os';
const POWERSHELL_TOOL_NAME = 'PowerShell';
const MAX_OUTPUT_SIZE = 128 * 1024; // 128KB
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_TIMEOUT_MS = 600_000; // 10 minutes
const inputSchema = z.strictObject({
    command: z.string().describe('The PowerShell command to execute'),
    timeout: z.number().optional().describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`),
    description: z.string().optional().describe('Clear, concise description of what this command does. ' +
        'Examples: "List running services", "Get system information"'),
});
const READ_ONLY_COMMANDS = new Set([
    'Get-ChildItem', 'Get-Content', 'Get-Item', 'Get-Location', 'Get-Process',
    'Get-Service', 'Get-Date', 'Get-Host', 'Get-Command', 'Get-Help',
    'Get-Variable', 'Get-Alias', 'Get-Module', 'Get-Member', 'Get-WmiObject',
    'Test-Path', 'Test-Connection', 'Select-Object', 'Where-Object',
    'Write-Output', 'Write-Host', 'Format-List', 'Format-Table',
    'Measure-Object', 'Sort-Object', 'Group-Object',
]);
function isReadOnlyCommand(command) {
    const trimmed = command.trim();
    for (const readOnly of READ_ONLY_COMMANDS) {
        if (trimmed === readOnly ||
            trimmed.startsWith(readOnly + ' ') ||
            trimmed.toLowerCase() === readOnly.toLowerCase() ||
            trimmed.toLowerCase().startsWith(readOnly.toLowerCase() + ' ')) {
            return true;
        }
    }
    return false;
}
export const PowerShellTool = buildTool({
    name: POWERSHELL_TOOL_NAME,
    searchHint: 'execute PowerShell commands on Windows',
    maxResultSizeChars: 30_000,
    strict: true,
    inputSchema,
    async description({ description }) {
        return description || 'Run PowerShell command';
    },
    async prompt() {
        return `Execute a PowerShell command. Only available on Windows platforms.

Important guidelines:
- Use this tool for Windows-specific operations and PowerShell cmdlets
- Prefer dedicated tools (FileRead, FileEdit, Grep, Glob) over PowerShell when possible
- Set appropriate timeouts for long-running commands
- Avoid interactive commands that require user input
- On non-Windows platforms, this tool will return an error`;
    },
    isConcurrencySafe(input) {
        return isReadOnlyCommand(input.command);
    },
    isReadOnly(input) {
        return isReadOnlyCommand(input.command);
    },
    userFacingName(_input) {
        return 'PowerShell';
    },
    toAutoClassifierInput(input) {
        return input.command;
    },
    getToolUseSummary(input) {
        if (!input?.command)
            return null;
        const cmd = input.command;
        return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
    },
    getActivityDescription(input) {
        if (!input?.command)
            return 'Running PowerShell command';
        const desc = input.description ?? input.command;
        const truncated = desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
        return `Running ${truncated}`;
    },
    async validateInput(input) {
        if (!input.command || !input.command.trim()) {
            return { result: false, message: 'Command cannot be empty', errorCode: 1 };
        }
        if (input.timeout !== undefined && input.timeout > MAX_TIMEOUT_MS) {
            return { result: false, message: `Timeout cannot exceed ${MAX_TIMEOUT_MS}ms`, errorCode: 2 };
        }
        return { result: true };
    },
    async preparePermissionMatcher({ command }) {
        const subcommands = command.split(/\s*;\s*|\s*\|\s*/).map(c => c.trim()).filter(Boolean);
        return (pattern) => {
            return subcommands.some(cmd => {
                if (pattern.includes('*')) {
                    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
                    return regex.test(cmd);
                }
                return cmd === pattern;
            });
        };
    },
    async call(input, context) {
        if (platform() !== 'win32') {
            return {
                data: {
                    stdout: '',
                    stderr: 'PowerShell is not available on this platform. This tool is only supported on Windows. Use the Bash tool instead.',
                    interrupted: false,
                    exitCode: 1,
                },
            };
        }
        const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
        const cwd = context.getCwd();
        const fullCommand = `powershell.exe -Command "${input.command.replace(/"/g, '\\"')}"`;
        try {
            const stdout = execSync(fullCommand, {
                cwd,
                encoding: 'utf-8',
                timeout,
                maxBuffer: 10 * 1024 * 1024,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });
            const truncatedStdout = stdout.length > MAX_OUTPUT_SIZE
                ? stdout.slice(0, MAX_OUTPUT_SIZE) + `\n... (truncated, ${stdout.length} bytes total)`
                : stdout;
            return {
                data: {
                    stdout: truncatedStdout,
                    stderr: '',
                    interrupted: false,
                    exitCode: 0,
                },
            };
        }
        catch (err) {
            const e = err;
            const stdout = (e.stdout || '').slice(0, MAX_OUTPUT_SIZE);
            const stderr = (e.stderr || '').slice(0, MAX_OUTPUT_SIZE);
            const interrupted = e.killed ?? false;
            return {
                data: {
                    stdout,
                    stderr,
                    interrupted,
                    exitCode: e.status ?? 1,
                },
            };
        }
    },
    mapToolResultToToolResultBlockParam(data, toolUseID) {
        const output = data.stderr
            ? `${data.stdout}\n${data.stderr}`.trim()
            : data.stdout.trim();
        const isError = data.exitCode !== 0;
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: output || (isError ? `Command failed with exit code ${data.exitCode}` : '(no output)'),
            is_error: isError,
        };
    },
});
export { POWERSHELL_TOOL_NAME };
//# sourceMappingURL=PowerShellTool.js.map