/**
 * ConfigTool — Read/write kite.config.json configuration.
 *
 * Supports 'get' and 'set' actions:
 * - get: Read the entire config or a specific key
 * - set: Update a specific key-value pair
 *
 * Config file is stored as kite.config.json in the current working directory.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { buildTool } from '../../Tool.js';
const CONFIG_TOOL_NAME = 'Config';
const CONFIG_FILENAME = 'kite.config.json';
const inputSchema = z.strictObject({
    action: z.enum(['get', 'set']).describe('Action to perform: "get" to read config, "set" to update a key'),
    key: z.string().optional().describe('Config key to get or set. If omitted for "get", returns entire config.'),
    value: z.unknown().optional().describe('Value to set for the given key (required when action is "set")'),
});
function readConfig(cwd) {
    const configPath = join(cwd, CONFIG_FILENAME);
    if (!existsSync(configPath)) {
        return {};
    }
    try {
        const raw = readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
function writeConfig(cwd, config) {
    const configPath = join(cwd, CONFIG_FILENAME);
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
export const ConfigTool = buildTool({
    name: CONFIG_TOOL_NAME,
    searchHint: 'read write kite configuration settings',
    maxResultSizeChars: 30_000,
    strict: true,
    shouldDefer: true,
    inputSchema,
    isReadOnly(input) {
        return input.action === 'get';
    },
    isConcurrencySafe(input) {
        return input.action === 'get';
    },
    async description({ action, key }) {
        if (action === 'get') {
            return key ? `Read config key "${key}"` : 'Read entire config';
        }
        return key ? `Set config key "${key}"` : 'Update config';
    },
    async prompt() {
        return `Read or write the kite.config.json configuration file.

Actions:
- "get": Read configuration. If "key" is provided, returns that specific value. Otherwise returns the entire config object.
- "set": Update a configuration key. Both "key" and "value" are required.

Examples:
- Get all config: { "action": "get" }
- Get a key: { "action": "get", "key": "theme" }
- Set a key: { "action": "set", "key": "theme", "value": "dark" }

The config file (kite.config.json) is stored in the current working directory.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'Config';
    },
    toAutoClassifierInput(input) {
        return `config ${input.action} ${input.key ?? 'all'}`;
    },
    getToolUseSummary(input) {
        if (!input?.action)
            return null;
        if (input.action === 'get') {
            return input.key ? `Get config "${input.key}"` : 'Get config';
        }
        return input.key ? `Set config "${input.key}"` : 'Set config';
    },
    getActivityDescription(input) {
        if (!input?.action)
            return 'Managing config';
        if (input.action === 'get') {
            return input.key ? `Reading config key "${input.key}"` : 'Reading config';
        }
        return input.key ? `Setting config key "${input.key}"` : 'Updating config';
    },
    async validateInput(input) {
        if (input.action === 'set') {
            if (!input.key) {
                return { result: false, message: 'A "key" is required when action is "set"', errorCode: 1 };
            }
            if (input.value === undefined) {
                return { result: false, message: 'A "value" is required when action is "set"', errorCode: 2 };
            }
        }
        return { result: true };
    },
    async call(input, context) {
        const cwd = context.getCwd();
        const config = readConfig(cwd);
        if (input.action === 'get') {
            const value = input.key !== undefined ? config[input.key] : config;
            return {
                data: {
                    action: 'get',
                    key: input.key,
                    value: value ?? null,
                    config,
                },
            };
        }
        // action === 'set'
        const key = input.key;
        const value = input.value;
        config[key] = value;
        writeConfig(cwd, config);
        return {
            data: {
                action: 'set',
                key,
                value,
                config,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        let text;
        if (content.action === 'get') {
            if (content.key) {
                text = `Config "${content.key}": ${JSON.stringify(content.value, null, 2)}`;
            }
            else {
                text = `Config:\n${JSON.stringify(content.config, null, 2)}`;
            }
        }
        else {
            text = `Config "${content.key}" set to: ${JSON.stringify(content.value, null, 2)}`;
        }
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: text,
        };
    },
});
export { CONFIG_TOOL_NAME };
//# sourceMappingURL=ConfigTool.js.map