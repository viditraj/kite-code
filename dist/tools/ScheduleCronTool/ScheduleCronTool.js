/**
 * ScheduleCronTool — Create, list, and delete cron-like scheduled tasks.
 *
 * Provides three tools:
 * - ScheduleCronCreate: Store a cron configuration in appState
 * - ScheduleCronList: Return all stored cron configurations
 * - ScheduleCronDelete: Remove a cron configuration by ID
 *
 * All cron data is stored in appState.crons as an array.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from '../../Tool.js';
const SCHEDULE_CRON_CREATE_NAME = 'ScheduleCronCreate';
const SCHEDULE_CRON_LIST_NAME = 'ScheduleCronList';
const SCHEDULE_CRON_DELETE_NAME = 'ScheduleCronDelete';
function getCrons(appState) {
    const crons = appState.crons;
    if (Array.isArray(crons))
        return crons;
    return [];
}
// ============================================================================
// ScheduleCronCreate
// ============================================================================
const createInputSchema = z.strictObject({
    schedule: z.string().describe('Cron schedule expression (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * 1-5" for weekdays at 9am)'),
    command: z.string().describe('The command or action to execute on the schedule'),
    description: z.string().optional().describe('Human-readable description of this scheduled task'),
    enabled: z.boolean().optional().describe('Whether the cron job is enabled (default: true)'),
});
export const ScheduleCronCreate = buildTool({
    name: SCHEDULE_CRON_CREATE_NAME,
    searchHint: 'create schedule cron job recurring task',
    maxResultSizeChars: 10_000,
    strict: true,
    shouldDefer: true,
    inputSchema: createInputSchema,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
    async description({ schedule, command }) {
        return `Schedule "${command}" with cron "${schedule}"`;
    },
    async prompt() {
        return `Create a new scheduled cron task.

Input:
- schedule: Cron expression (e.g., "*/5 * * * *", "0 9 * * 1-5")
- command: The command or action to run
- description: (optional) Human-readable description
- enabled: (optional) Whether the job is enabled (default: true)

The cron entry is stored in the session state and can be listed or deleted later.
Use ScheduleCronList to view all scheduled tasks and ScheduleCronDelete to remove one.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'ScheduleCronCreate';
    },
    toAutoClassifierInput(input) {
        return `cron create ${input.schedule} ${input.command}`;
    },
    getToolUseSummary(input) {
        if (!input?.command)
            return null;
        return `Creating cron: "${input.command}"`;
    },
    getActivityDescription(input) {
        if (!input?.command)
            return 'Creating cron job';
        return `Creating cron job for "${input.command}"`;
    },
    async validateInput(input) {
        if (!input.schedule || !input.schedule.trim()) {
            return { result: false, message: 'Schedule expression cannot be empty', errorCode: 1 };
        }
        if (!input.command || !input.command.trim()) {
            return { result: false, message: 'Command cannot be empty', errorCode: 2 };
        }
        // Basic cron expression validation: should have 5 space-separated fields
        const parts = input.schedule.trim().split(/\s+/);
        if (parts.length < 5 || parts.length > 6) {
            return {
                result: false,
                message: 'Invalid cron expression: expected 5 or 6 space-separated fields (minute hour day month weekday [year])',
                errorCode: 3,
            };
        }
        return { result: true };
    },
    async call(input, context) {
        const newCron = {
            id: randomUUID(),
            schedule: input.schedule.trim(),
            command: input.command.trim(),
            description: input.description?.trim() || input.command.trim(),
            createdAt: new Date().toISOString(),
            enabled: input.enabled ?? true,
        };
        context.setAppState((prev) => {
            const existing = getCrons(prev);
            return {
                ...prev,
                crons: [...existing, newCron],
            };
        });
        return {
            data: {
                cron: newCron,
                message: `Created cron job "${newCron.id}": ${newCron.schedule} → ${newCron.command}`,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        const cron = content.cron;
        const text = [
            content.message,
            '',
            `  ID: ${cron.id}`,
            `  Schedule: ${cron.schedule}`,
            `  Command: ${cron.command}`,
            `  Description: ${cron.description}`,
            `  Enabled: ${cron.enabled}`,
            `  Created: ${cron.createdAt}`,
        ].join('\n');
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: text,
        };
    },
});
// ============================================================================
// ScheduleCronList
// ============================================================================
const listInputSchema = z.strictObject({});
export const ScheduleCronList = buildTool({
    name: SCHEDULE_CRON_LIST_NAME,
    searchHint: 'list scheduled cron jobs',
    maxResultSizeChars: 30_000,
    strict: true,
    shouldDefer: true,
    inputSchema: listInputSchema,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    async description() {
        return 'List all scheduled cron jobs';
    },
    async prompt() {
        return `List all scheduled cron tasks stored in the session.

Returns all cron entries with their IDs, schedules, commands, and status.
Use ScheduleCronCreate to add new entries and ScheduleCronDelete to remove them.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'ScheduleCronList';
    },
    toAutoClassifierInput() {
        return 'cron list';
    },
    getToolUseSummary() {
        return 'Listing cron jobs';
    },
    getActivityDescription() {
        return 'Listing scheduled cron jobs';
    },
    async call(_input, context) {
        const appState = context.getAppState();
        const crons = getCrons(appState);
        const message = crons.length === 0
            ? 'No cron jobs scheduled.'
            : `Found ${crons.length} scheduled cron job(s).`;
        return {
            data: {
                crons,
                message,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        if (content.crons.length === 0) {
            return {
                type: 'tool_result',
                tool_use_id: toolUseID,
                content: 'No cron jobs scheduled.',
            };
        }
        const lines = [content.message, ''];
        for (const cron of content.crons) {
            lines.push(`[${cron.enabled ? '✓' : '✗'}] ${cron.id}`);
            lines.push(`    Schedule: ${cron.schedule}`);
            lines.push(`    Command: ${cron.command}`);
            lines.push(`    Description: ${cron.description}`);
            lines.push(`    Created: ${cron.createdAt}`);
            lines.push('');
        }
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: lines.join('\n').trim(),
        };
    },
});
// ============================================================================
// ScheduleCronDelete
// ============================================================================
const deleteInputSchema = z.strictObject({
    id: z.string().describe('The unique ID of the cron job to delete'),
});
export const ScheduleCronDelete = buildTool({
    name: SCHEDULE_CRON_DELETE_NAME,
    searchHint: 'delete remove cron job scheduled task',
    maxResultSizeChars: 5_000,
    strict: true,
    shouldDefer: true,
    inputSchema: deleteInputSchema,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
    async description({ id }) {
        return `Delete cron job "${id}"`;
    },
    async prompt() {
        return `Delete a scheduled cron task by its ID.

Input:
- id: The unique identifier of the cron job to remove

Use ScheduleCronList to find the IDs of existing cron jobs.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'ScheduleCronDelete';
    },
    toAutoClassifierInput(input) {
        return `cron delete ${input.id}`;
    },
    getToolUseSummary(input) {
        if (!input?.id)
            return null;
        return `Deleting cron "${input.id}"`;
    },
    getActivityDescription(input) {
        if (!input?.id)
            return 'Deleting cron job';
        return `Deleting cron job "${input.id}"`;
    },
    async validateInput(input) {
        if (!input.id || !input.id.trim()) {
            return { result: false, message: 'Cron job ID cannot be empty', errorCode: 1 };
        }
        return { result: true };
    },
    async call(input, context) {
        const appState = context.getAppState();
        const crons = getCrons(appState);
        const targetId = input.id.trim();
        const index = crons.findIndex(c => c.id === targetId);
        if (index === -1) {
            return {
                data: {
                    id: targetId,
                    deleted: false,
                    message: `Cron job "${targetId}" not found. Use ScheduleCronList to see available cron jobs.`,
                },
            };
        }
        const removed = crons[index];
        context.setAppState((prev) => {
            const existing = getCrons(prev);
            return {
                ...prev,
                crons: existing.filter(c => c.id !== targetId),
            };
        });
        return {
            data: {
                id: targetId,
                deleted: true,
                message: `Deleted cron job "${targetId}" (${removed.schedule} → ${removed.command})`,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.message,
            is_error: !content.deleted,
        };
    },
});
export { SCHEDULE_CRON_CREATE_NAME, SCHEDULE_CRON_LIST_NAME, SCHEDULE_CRON_DELETE_NAME, };
//# sourceMappingURL=ScheduleCronTool.js.map