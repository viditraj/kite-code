/**
 * ReadMcpResourceTool — Read a specific resource from an MCP server.
 *
 * Reads a resource identified by server name and resource URI.
 * Currently returns a helpful message directing users to the /mcp command.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
import { buildTool } from '../../Tool.js';
const READ_MCP_RESOURCE_TOOL_NAME = 'ReadMcpResource';
const inputSchema = z.strictObject({
    server_name: z.string().describe('Name of the MCP server to read from (e.g., "linear", "github")'),
    resource_uri: z.string().describe('Resource URI to read (e.g., "file:///path/to/file", "linear://issue/123")'),
});
export const ReadMcpResourceTool = buildTool({
    name: READ_MCP_RESOURCE_TOOL_NAME,
    searchHint: 'read MCP server resource model context protocol',
    maxResultSizeChars: 100_000,
    strict: true,
    shouldDefer: true,
    inputSchema,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    async description({ server_name, resource_uri }) {
        return `Read resource "${resource_uri}" from MCP server "${server_name}"`;
    },
    async prompt() {
        return `Read a specific resource from an MCP (Model Context Protocol) server.

Input:
- server_name: Name of the MCP server to read from (e.g., "linear", "github", "slack")
- resource_uri: URI identifying the resource to read (e.g., "file:///path", "linear://issue/123")

Returns the resource content as text or binary data. Resources can be files, database records, API responses, or any data exposed by the MCP server.

Use ListMcpResources first to discover available resources. To manage MCP server connections, use the /mcp command.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'ReadMcpResource';
    },
    toAutoClassifierInput(input) {
        return `read mcp resource ${input.server_name} ${input.resource_uri}`;
    },
    getToolUseSummary(input) {
        if (!input?.server_name || !input?.resource_uri)
            return null;
        const uri = input.resource_uri.length > 60
            ? input.resource_uri.slice(0, 60) + '...'
            : input.resource_uri;
        return `Read "${uri}" from ${input.server_name}`;
    },
    getActivityDescription(input) {
        if (!input?.server_name)
            return 'Reading MCP resource';
        return `Reading resource from "${input.server_name}"`;
    },
    async validateInput(input) {
        if (!input.server_name || !input.server_name.trim()) {
            return { result: false, message: 'server_name cannot be empty', errorCode: 1 };
        }
        if (!input.resource_uri || !input.resource_uri.trim()) {
            return { result: false, message: 'resource_uri cannot be empty', errorCode: 2 };
        }
        return { result: true };
    },
    async call(input) {
        const message = [
            `MCP resource reading is not yet connected to a live MCP manager.`,
            '',
            `Requested resource:`,
            `  Server: ${input.server_name}`,
            `  URI: ${input.resource_uri}`,
            '',
            'To manage MCP servers and their resources, use the /mcp command:',
            '  /mcp                   — Show MCP server status',
            '  /mcp add <server>      — Add a new MCP server',
            '  /mcp remove <server>   — Remove an MCP server',
            '',
            'Once MCP servers are connected, this tool will read the specified resource',
            'and return its content.',
        ].join('\n');
        return {
            data: {
                server_name: input.server_name,
                resource_uri: input.resource_uri,
                content: null,
                message,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        if (content.content !== null) {
            return {
                type: 'tool_result',
                tool_use_id: toolUseID,
                content: content.content,
            };
        }
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.message,
        };
    },
});
export { READ_MCP_RESOURCE_TOOL_NAME };
//# sourceMappingURL=ReadMcpResourceTool.js.map