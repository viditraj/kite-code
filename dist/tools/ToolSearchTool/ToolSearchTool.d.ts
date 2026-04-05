/**
 * ToolSearchTool — Search for deferred tools by keyword or direct selection.
 *
 * Implements the same patterns as Claude Code's ToolSearchTool:
 * - select: prefix for direct tool selection
 * - Keyword-based scoring (name parts, searchHint, description)
 * - Required terms with + prefix
 * - MCP tool name parsing (mcp__server__action)
 */
import { z } from 'zod';
import type { Tool } from '../../Tool.js';
export declare const TOOL_SEARCH_TOOL_NAME = "ToolSearch";
/**
 * Check if a tool is deferred (should be loaded on demand).
 */
export declare function isDeferredTool(tool: Tool): boolean;
export declare const ToolSearchTool: Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=ToolSearchTool.d.ts.map