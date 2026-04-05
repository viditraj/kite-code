/**
 * AgentTool — Launch subagent for delegated tasks.
 *
 * Implements the same patterns as Claude Code's AgentTool:
 * - Spawn a subagent with its own query loop via the query() async generator
 * - Sync (foreground) execution drives the query loop directly
 * - Async (background) execution fires and forgets with notification on completion
 * - Result finalization extracts last assistant text + metrics
 * - Progress forwarding from nested tool execution
 */
import { z } from 'zod';
import type { Tool } from '../../Tool.js';
export declare const AGENT_TOOL_NAME = "Agent";
export declare const LEGACY_AGENT_TOOL_NAME = "Task";
export interface AgentToolResult {
    agentId: string;
    content: Array<{
        type: 'text';
        text: string;
    }>;
    totalToolUseCount: number;
    totalDurationMs: number;
    totalTokens: number;
}
export declare const AgentTool: Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=AgentTool.d.ts.map