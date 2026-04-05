/**
 * MCP Server Manager — manages multiple MCP server connections.
 *
 * Implements the same patterns as Claude Code's MCP manager:
 * - Batch connection with concurrency limits (local: 3, remote: 20)
 * - Tool discovery and conversion to Kite Tool objects
 * - Resource and prompt fetching
 * - Connection caching with invalidation
 * - Graceful shutdown of all servers
 * - Reconnection on session expiry
 */
import { createMCPTool } from '../../tools/MCPTool/MCPTool.js';
import { MCPClient } from './client.js';
import { createTransport } from './transport.js';
import { getAllMCPConfigs, isLocalMCPServer } from './config.js';
import { buildMCPToolName, MAX_MCP_DESCRIPTION_LENGTH, MCPToolCallError, } from './types.js';
// ============================================================================
// Constants
// ============================================================================
const LOCAL_BATCH_SIZE = 3;
const REMOTE_BATCH_SIZE = 20;
const MAX_SESSION_RETRIES = 1;
// ============================================================================
// MCPManager
// ============================================================================
export class MCPManager {
    connections = new Map();
    clients = new Map();
    transports = new Map();
    toolCache = new Map();
    resourceCache = new Map();
    promptCache = new Map();
    // ========================================================================
    // Connection management
    // ========================================================================
    /**
     * Connect to all configured MCP servers.
     * Uses different concurrency for local (stdio) vs remote (SSE/HTTP) servers.
     */
    async connectAll(cwd, onConnection) {
        const { servers, errors } = getAllMCPConfigs(cwd);
        if (errors.length > 0) {
            for (const err of errors) {
                console.error(`MCP config error: ${err}`);
            }
        }
        const entries = Object.entries(servers).filter(([, config]) => !config.disabled);
        // Partition into local and remote
        const localServers = entries.filter(([, config]) => isLocalMCPServer(config));
        const remoteServers = entries.filter(([, config]) => !isLocalMCPServer(config));
        // Connect with different concurrency
        const results = await Promise.all([
            this.connectBatch(localServers, LOCAL_BATCH_SIZE, onConnection),
            this.connectBatch(remoteServers, REMOTE_BATCH_SIZE, onConnection),
        ]);
        return [...results[0], ...results[1]];
    }
    /**
     * Connect to a batch of servers with a concurrency limit.
     */
    async connectBatch(entries, concurrency, onConnection) {
        const results = [];
        const queue = [...entries];
        const worker = async () => {
            while (queue.length > 0) {
                const entry = queue.shift();
                if (!entry)
                    break;
                const [name, config] = entry;
                const result = await this.connectServer(name, config);
                results.push(result);
                onConnection?.(result);
            }
        };
        const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker());
        await Promise.all(workers);
        return results;
    }
    /**
     * Connect to a single MCP server.
     */
    async connectServer(name, config) {
        // Check cache
        const existing = this.connections.get(name);
        if (existing?.type === 'connected') {
            return {
                connection: existing,
                tools: this.toolCache.get(name) ?? [],
                resources: this.resourceCache.get(name) ?? [],
                prompts: this.promptCache.get(name) ?? [],
            };
        }
        try {
            const transport = createTransport(config);
            const client = new MCPClient(name, transport);
            // Set up close handler to invalidate cache
            client.onclose = () => {
                this.connections.delete(name);
                this.toolCache.delete(name);
                this.resourceCache.delete(name);
                this.promptCache.delete(name);
            };
            // Connect with timeout
            const initResult = await client.connect();
            // Store connection
            this.clients.set(name, client);
            this.transports.set(name, transport);
            const connection = {
                name,
                type: 'connected',
                capabilities: initResult.capabilities,
                serverInfo: initResult.serverInfo,
                instructions: initResult.instructions
                    ? initResult.instructions.slice(0, MAX_MCP_DESCRIPTION_LENGTH)
                    : undefined,
                config,
                cleanup: () => client.close(),
            };
            this.connections.set(name, connection);
            // Fetch tools, resources, prompts
            const tools = await this.fetchTools(name, client);
            const resources = await this.fetchResources(name, client);
            const prompts = await this.fetchPrompts(name, client);
            // Set up notification handlers for cache invalidation
            client.setNotificationHandler('notifications/tools/list_changed', () => {
                this.toolCache.delete(name);
            });
            client.setNotificationHandler('notifications/resources/list_changed', () => {
                this.resourceCache.delete(name);
            });
            client.setNotificationHandler('notifications/prompts/list_changed', () => {
                this.promptCache.delete(name);
            });
            return { connection, tools, resources, prompts };
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            const connection = {
                name,
                type: 'failed',
                config,
                error: error.message,
            };
            this.connections.set(name, connection);
            return { connection, tools: [], resources: [], prompts: [] };
        }
    }
    // ========================================================================
    // Tool discovery & conversion
    // ========================================================================
    async fetchTools(name, client) {
        try {
            const mcpTools = await client.listTools();
            const tools = mcpTools.map(mcpTool => this.convertTool(name, client, mcpTool));
            this.toolCache.set(name, tools);
            return tools;
        }
        catch {
            return [];
        }
    }
    convertTool(name, client, mcpTool) {
        const toolName = buildMCPToolName(name, mcpTool.name);
        const description = mcpTool.description ?? '';
        const truncatedDesc = description.length > MAX_MCP_DESCRIPTION_LENGTH
            ? description.slice(0, MAX_MCP_DESCRIPTION_LENGTH) + '... [truncated]'
            : description;
        return createMCPTool({
            serverName: name,
            toolName: mcpTool.name,
            description: truncatedDesc,
            inputJsonSchema: mcpTool.inputSchema,
            execute: async (args) => {
                const result = await this.callToolWithRetry(name, client, mcpTool.name, args);
                return this.formatToolResult(result);
            },
        });
    }
    /**
     * Call a tool with session expiry retry.
     */
    async callToolWithRetry(serverName, client, toolName, args) {
        for (let attempt = 0;; attempt++) {
            try {
                const result = await client.callTool({
                    name: toolName,
                    arguments: args,
                });
                // Check for error result
                if (result.isError) {
                    let errorDetails = 'Unknown error';
                    if (result.content?.length > 0) {
                        const first = result.content[0];
                        if (first?.type === 'text') {
                            errorDetails = first.text;
                        }
                    }
                    throw new MCPToolCallError(errorDetails);
                }
                return result;
            }
            catch (err) {
                if (err instanceof Error && err.name === 'MCPSessionExpiredError' && attempt < MAX_SESSION_RETRIES) {
                    // Clear cache and retry
                    this.connections.delete(serverName);
                    this.toolCache.delete(serverName);
                    continue;
                }
                throw err;
            }
        }
    }
    /**
     * Format a tool call result for the LLM.
     *
     * When the result contains only text blocks, returns a plain string.
     * When it contains image blocks (e.g. screenshots from Playwright),
     * returns ContentBlock[] so the image data is passed through to the
     * model's vision capabilities.
     */
    formatToolResult(result) {
        if (!result.content || result.content.length === 0) {
            return '(No output)';
        }
        const hasImages = result.content.some(block => block.type === 'image');
        // Fast path: text-only results return a plain string
        if (!hasImages) {
            const parts = [];
            for (const block of result.content) {
                switch (block.type) {
                    case 'text':
                        parts.push(block.text);
                        break;
                    case 'resource':
                        if (block.resource.text) {
                            parts.push(block.resource.text);
                        }
                        else if (block.resource.blob) {
                            parts.push(`[Resource: ${block.resource.uri}, ${block.resource.mimeType ?? 'binary'}]`);
                        }
                        break;
                }
            }
            return parts.join('\n');
        }
        // Mixed content (text + images): return ContentBlock[] so images
        // are forwarded to the LLM as vision input.
        const blocks = [];
        for (const mcpBlock of result.content) {
            switch (mcpBlock.type) {
                case 'text':
                    blocks.push({ type: 'text', text: mcpBlock.text });
                    break;
                case 'image':
                    blocks.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mcpBlock.mimeType || 'image/png',
                            data: mcpBlock.data,
                        },
                    });
                    break;
                case 'resource':
                    if (mcpBlock.resource.text) {
                        blocks.push({ type: 'text', text: mcpBlock.resource.text });
                    }
                    else if (mcpBlock.resource.blob) {
                        blocks.push({ type: 'text', text: `[Resource: ${mcpBlock.resource.uri}, ${mcpBlock.resource.mimeType ?? 'binary'}]` });
                    }
                    break;
            }
        }
        return blocks;
    }
    // ========================================================================
    // Resource discovery
    // ========================================================================
    async fetchResources(name, client) {
        try {
            const mcpResources = await client.listResources();
            const resources = mcpResources.map(r => ({ ...r, server: name }));
            this.resourceCache.set(name, resources);
            return resources;
        }
        catch {
            return [];
        }
    }
    /**
     * Read a resource from a server.
     */
    async readResource(serverName, uri) {
        const client = this.clients.get(serverName);
        if (!client)
            throw new Error(`MCP server "${serverName}" not connected`);
        const result = await client.readResource(uri);
        if (!result.contents || result.contents.length === 0) {
            return '(No content)';
        }
        return result.contents.map(c => c.text ?? `[Binary: ${c.mimeType ?? 'unknown'}]`).join('\n');
    }
    // ========================================================================
    // Prompt discovery
    // ========================================================================
    async fetchPrompts(name, client) {
        try {
            const prompts = await client.listPrompts();
            this.promptCache.set(name, prompts);
            return prompts;
        }
        catch {
            return [];
        }
    }
    /**
     * Get a prompt from a server.
     */
    async getPrompt(serverName, promptName, args) {
        const client = this.clients.get(serverName);
        if (!client)
            throw new Error(`MCP server "${serverName}" not connected`);
        const result = await client.getPrompt(promptName, args);
        const parts = [];
        for (const msg of result.messages) {
            const content = Array.isArray(msg.content) ? msg.content : [msg.content];
            for (const block of content) {
                if (block.type === 'text')
                    parts.push(block.text);
            }
        }
        return parts.join('\n');
    }
    // ========================================================================
    // Aggregation
    // ========================================================================
    /**
     * Get all tools from all connected servers.
     */
    getAllTools() {
        const tools = [];
        for (const [, cached] of this.toolCache) {
            tools.push(...cached);
        }
        return tools;
    }
    /**
     * Get all resources from all connected servers.
     */
    getAllResources() {
        const resources = [];
        for (const [, cached] of this.resourceCache) {
            resources.push(...cached);
        }
        return resources;
    }
    /**
     * Get all connections and their states.
     */
    getConnections() {
        return new Map(this.connections);
    }
    /**
     * Get a specific connection.
     */
    getConnection(name) {
        return this.connections.get(name);
    }
    // ========================================================================
    // Shutdown
    // ========================================================================
    /**
     * Disconnect all servers gracefully.
     */
    async disconnectAll() {
        const cleanupPromises = [];
        for (const [name, client] of this.clients) {
            cleanupPromises.push(client.close().catch(err => {
                console.error(`Error closing MCP server "${name}": ${err}`);
            }));
        }
        await Promise.all(cleanupPromises);
        this.connections.clear();
        this.clients.clear();
        this.transports.clear();
        this.toolCache.clear();
        this.resourceCache.clear();
        this.promptCache.clear();
    }
    /**
     * Disconnect a single server.
     */
    async disconnectServer(name) {
        const client = this.clients.get(name);
        if (client) {
            await client.close();
        }
        this.connections.delete(name);
        this.clients.delete(name);
        this.transports.delete(name);
        this.toolCache.delete(name);
        this.resourceCache.delete(name);
        this.promptCache.delete(name);
    }
}
//# sourceMappingURL=manager.js.map