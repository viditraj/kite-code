import { z } from 'zod';
import type { Tool } from '../../Tool.js';
import type { ContentBlock } from '../../providers/types.js';
export declare const MCP_TOOL_PREFIX = "mcp__";
/** MCP tool output can be plain text or structured content blocks (including images). */
export type MCPToolOutput = string | ContentBlock[];
export declare const MCPTool: Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare function createMCPTool(options: {
    serverName: string;
    toolName: string;
    description: string;
    inputJsonSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>) => Promise<MCPToolOutput>;
}): Tool;
//# sourceMappingURL=MCPTool.d.ts.map