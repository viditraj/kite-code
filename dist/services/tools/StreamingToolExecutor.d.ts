/**
 * Streaming tool executor with concurrent/serial execution.
 *
 * Implements the same patterns as Claude Code's StreamingToolExecutor.ts:
 * - Concurrent-safe tools run in parallel
 * - Non-concurrent tools run exclusively (one at a time)
 * - Results yielded in order as tools complete
 * - Sibling abort: Bash errors cancel parallel siblings
 * - Progress messages yielded immediately
 * - discard() for streaming fallback
 */
import { type Tools } from '../../Tool.js';
import type { ToolUseContext } from '../../Tool.js';
import type { ContentBlock } from '../../providers/types.js';
export interface ToolUseBlock {
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ToolExecutionResult {
    toolUseId: string;
    toolName: string;
    output: string;
    isError: boolean;
    /** The raw content block for the API */
    contentBlock: ContentBlock;
}
export type ToolExecutionEvent = {
    type: 'tool_start';
    toolUseId: string;
    toolName: string;
} | {
    type: 'tool_progress';
    toolUseId: string;
    message: string;
} | {
    type: 'tool_result';
    result: ToolExecutionResult;
};
export declare class StreamingToolExecutor {
    private tools;
    private toolDefinitions;
    private context;
    private hasErrored;
    private erroredToolDescription;
    private siblingAbortController;
    private discarded;
    constructor(toolDefinitions: Tools, context: ToolUseContext);
    /**
     * Discard all pending and in-progress tools.
     * Called when streaming fallback occurs.
     */
    discard(): void;
    /**
     * Add a tool to the execution queue.
     * Starts executing immediately if conditions allow.
     */
    addTool(block: ToolUseBlock): void;
    /**
     * Get all results as an async generator.
     * Yields events as tools start, progress, and complete.
     */
    getResults(): AsyncGenerator<ToolExecutionEvent, void, undefined>;
    private canExecuteTool;
    private processQueue;
    private processQueueSync;
    private executeTool;
    private collectCompleted;
    private hasUnfinishedTools;
    private hasCompletedTools;
}
//# sourceMappingURL=StreamingToolExecutor.d.ts.map