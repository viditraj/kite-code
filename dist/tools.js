/**
 * Tool registry and assembly.
 *
 * Implements the same patterns as Claude Code's tools.ts:
 * - getAllBaseTools() returns all available tools
 * - getTools() filters by deny rules and isEnabled
 * - assembleToolPool() combines built-in + MCP tools, sorted for cache stability
 */
// Tool instances are registered here
let registeredTools = [];
/**
 * Register tools. Called once at startup.
 */
export function registerTools(tools) {
    registeredTools = [...tools];
}
/**
 * Get all base tools (respecting isEnabled).
 */
export function getAllBaseTools() {
    return registeredTools.filter(t => t.isEnabled());
}
/**
 * Get tools filtered by deny rules.
 *
 * Ported from: getTools in tools.ts.
 */
export function getTools(denyList) {
    const tools = getAllBaseTools();
    if (!denyList || denyList.size === 0)
        return tools;
    return tools.filter(t => !denyList.has(t.name));
}
/**
 * Assemble the full tool pool (built-in + MCP tools).
 *
 * Ported from: assembleToolPool in tools.ts.
 * Deduplicates by name (built-in wins), sorts for prompt-cache stability.
 */
export function assembleToolPool(denyList, mcpTools) {
    const builtIn = getTools(denyList);
    if (!mcpTools || mcpTools.length === 0) {
        return [...builtIn].sort((a, b) => a.name.localeCompare(b.name));
    }
    // Filter MCP tools by deny list
    const allowedMcp = denyList
        ? mcpTools.filter(t => !denyList.has(t.name))
        : [...mcpTools];
    // Deduplicate: built-in tools take precedence
    const seen = new Set(builtIn.map(t => t.name));
    const combined = [
        ...builtIn,
        ...allowedMcp.filter(t => !seen.has(t.name)),
    ];
    // Sort for prompt-cache stability (matching Claude Code's tools.ts)
    return combined.sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Filter tools by deny rules.
 * A tool is filtered out if its name is in the deny set.
 * Matches MCP server-prefix rules: "mcp__server" strips all tools from that server.
 *
 * Ported from: filterToolsByDenyRules in tools.ts
 */
export function filterToolsByDenyRules(tools, denyList) {
    if (denyList.size === 0)
        return tools;
    return tools.filter(tool => {
        if (denyList.has(tool.name))
            return false;
        // MCP server-level deny: "mcp__server1" denies "mcp__server1__tool1"
        if (tool.mcpInfo) {
            const serverDeny = `mcp__${tool.mcpInfo.serverName}`;
            if (denyList.has(serverDeny))
                return false;
        }
        return true;
    });
}
/**
 * Get all tools including both built-in and MCP tools.
 *
 * Ported from: getMergedTools in tools.ts
 */
export function getMergedTools(denyList, mcpTools) {
    const builtIn = getTools(denyList);
    if (!mcpTools || mcpTools.length === 0)
        return builtIn;
    return [...builtIn, ...mcpTools];
}
/**
 * Convert tools to JSON Schema format for the LLM API.
 */
export function toolsToSchemas(tools) {
    return tools.map(tool => {
        // If tool has inputJSONSchema, use it directly (MCP tools)
        if (tool.inputJSONSchema) {
            return {
                name: tool.name,
                description: tool.searchHint || tool.name,
                input_schema: tool.inputJSONSchema,
            };
        }
        // Otherwise, convert Zod schema to JSON Schema
        // Zod doesn't have built-in JSON Schema export, so we use the shape
        const schema = tool.inputSchema;
        let jsonSchema = { type: 'object' };
        try {
            // Access Zod's internal shape for strictObject schemas
            const shape = schema?._def?.shape?.();
            if (shape) {
                const properties = {};
                const required = [];
                for (const [key, value] of Object.entries(shape)) {
                    const fieldSchema = value;
                    const description = fieldSchema?._def?.description || fieldSchema?.description || '';
                    const isOptional = fieldSchema?.isOptional?.() ?? fieldSchema?._def?.typeName === 'ZodOptional';
                    // Determine the type
                    let type = 'string';
                    const typeName = fieldSchema?._def?.typeName || fieldSchema?._def?.innerType?._def?.typeName;
                    if (typeName === 'ZodNumber')
                        type = 'number';
                    else if (typeName === 'ZodBoolean')
                        type = 'boolean';
                    else if (typeName === 'ZodArray')
                        type = 'array';
                    else if (typeName === 'ZodEnum')
                        type = 'string';
                    properties[key] = { type, description };
                    if (!isOptional) {
                        required.push(key);
                    }
                }
                jsonSchema = { type: 'object', properties };
                if (required.length > 0) {
                    jsonSchema.required = required;
                }
            }
        }
        catch {
            // Fallback: empty object schema
            jsonSchema = { type: 'object', properties: {} };
        }
        return {
            name: tool.name,
            description: tool.searchHint || tool.name,
            input_schema: jsonSchema,
        };
    });
}
//# sourceMappingURL=tools.js.map