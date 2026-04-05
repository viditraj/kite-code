/**
 * ReadMcpResourceTool — Read a specific resource from an MCP server.
 *
 * Reads a resource identified by server name and resource URI.
 * Currently returns a helpful message directing users to the /mcp command.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const READ_MCP_RESOURCE_TOOL_NAME = "ReadMcpResource";
export declare const ReadMcpResourceTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { READ_MCP_RESOURCE_TOOL_NAME };
//# sourceMappingURL=ReadMcpResourceTool.d.ts.map