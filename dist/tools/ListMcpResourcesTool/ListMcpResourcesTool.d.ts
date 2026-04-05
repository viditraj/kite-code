/**
 * ListMcpResourcesTool — List resources from MCP servers.
 *
 * Lists available resources from MCP (Model Context Protocol) servers.
 * Currently returns a helpful message directing users to the /mcp command.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const LIST_MCP_RESOURCES_TOOL_NAME = "ListMcpResources";
export declare const ListMcpResourcesTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { LIST_MCP_RESOURCES_TOOL_NAME };
//# sourceMappingURL=ListMcpResourcesTool.d.ts.map