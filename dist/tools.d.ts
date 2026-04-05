/**
 * Tool registry and assembly.
 *
 * Implements the same patterns as Claude Code's tools.ts:
 * - getAllBaseTools() returns all available tools
 * - getTools() filters by deny rules and isEnabled
 * - assembleToolPool() combines built-in + MCP tools, sorted for cache stability
 */
import { type Tool, type Tools } from './Tool.js';
/**
 * Register tools. Called once at startup.
 */
export declare function registerTools(tools: Tool[]): void;
/**
 * Get all base tools (respecting isEnabled).
 */
export declare function getAllBaseTools(): Tools;
/**
 * Get tools filtered by deny rules.
 *
 * Ported from: getTools in tools.ts.
 */
export declare function getTools(denyList?: Set<string>): Tools;
/**
 * Assemble the full tool pool (built-in + MCP tools).
 *
 * Ported from: assembleToolPool in tools.ts.
 * Deduplicates by name (built-in wins), sorts for prompt-cache stability.
 */
export declare function assembleToolPool(denyList?: Set<string>, mcpTools?: Tools): Tools;
/**
 * Filter tools by deny rules.
 * A tool is filtered out if its name is in the deny set.
 * Matches MCP server-prefix rules: "mcp__server" strips all tools from that server.
 *
 * Ported from: filterToolsByDenyRules in tools.ts
 */
export declare function filterToolsByDenyRules(tools: Tools, denyList: Set<string>): Tools;
/**
 * Get all tools including both built-in and MCP tools.
 *
 * Ported from: getMergedTools in tools.ts
 */
export declare function getMergedTools(denyList?: Set<string>, mcpTools?: Tools): Tools;
/**
 * Convert tools to JSON Schema format for the LLM API.
 */
export declare function toolsToSchemas(tools: Tools): Array<{
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
    };
}>;
//# sourceMappingURL=tools.d.ts.map