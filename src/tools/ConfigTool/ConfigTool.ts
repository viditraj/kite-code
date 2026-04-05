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

import { z } from 'zod'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const CONFIG_TOOL_NAME = 'Config'
const CONFIG_FILENAME = 'kite.config.json'

const inputSchema = z.strictObject({
  action: z.enum(['get', 'set']).describe('Action to perform: "get" to read config, "set" to update a key'),
  key: z.string().optional().describe('Config key to get or set. If omitted for "get", returns entire config.'),
  value: z.unknown().optional().describe('Value to set for the given key (required when action is "set")'),
})

type ConfigInput = z.infer<typeof inputSchema>

interface ConfigOutput {
  action: 'get' | 'set'
  key?: string
  value: unknown
  config: Record<string, unknown>
}

function readConfig(cwd: string): Record<string, unknown> {
  const configPath = join(cwd, CONFIG_FILENAME)
  if (!existsSync(configPath)) {
    return {}
  }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  const configPath = join(cwd, CONFIG_FILENAME)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export const ConfigTool = buildTool({
  name: CONFIG_TOOL_NAME,
  searchHint: 'read write kite configuration settings',
  maxResultSizeChars: 30_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly(input: ConfigInput) {
    return input.action === 'get'
  },

  isConcurrencySafe(input: ConfigInput) {
    return input.action === 'get'
  },

  async description({ action, key }: ConfigInput) {
    if (action === 'get') {
      return key ? `Read config key "${key}"` : 'Read entire config'
    }
    return key ? `Set config key "${key}"` : 'Update config'
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

The config file (kite.config.json) is stored in the current working directory.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'Config'
  },

  toAutoClassifierInput(input: ConfigInput) {
    return `config ${input.action} ${input.key ?? 'all'}`
  },

  getToolUseSummary(input?: Partial<ConfigInput>) {
    if (!input?.action) return null
    if (input.action === 'get') {
      return input.key ? `Get config "${input.key}"` : 'Get config'
    }
    return input.key ? `Set config "${input.key}"` : 'Set config'
  },

  getActivityDescription(input?: Partial<ConfigInput>) {
    if (!input?.action) return 'Managing config'
    if (input.action === 'get') {
      return input.key ? `Reading config key "${input.key}"` : 'Reading config'
    }
    return input.key ? `Setting config key "${input.key}"` : 'Updating config'
  },

  async validateInput(input: ConfigInput) {
    if (input.action === 'set') {
      if (!input.key) {
        return { result: false, message: 'A "key" is required when action is "set"', errorCode: 1 }
      }
      if (input.value === undefined) {
        return { result: false, message: 'A "value" is required when action is "set"', errorCode: 2 }
      }
    }
    return { result: true }
  },

  async call(input: ConfigInput, context: ToolUseContext) {
    const cwd = context.getCwd()
    const config = readConfig(cwd)

    if (input.action === 'get') {
      const value = input.key !== undefined ? config[input.key] : config
      return {
        data: {
          action: 'get',
          key: input.key,
          value: value ?? null,
          config,
        } as ConfigOutput,
      }
    }

    // action === 'set'
    const key = input.key!
    const value = input.value
    config[key] = value
    writeConfig(cwd, config)

    return {
      data: {
        action: 'set',
        key,
        value,
        config,
      } as ConfigOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: ConfigOutput, toolUseID: string) {
    let text: string
    if (content.action === 'get') {
      if (content.key) {
        text = `Config "${content.key}": ${JSON.stringify(content.value, null, 2)}`
      } else {
        text = `Config:\n${JSON.stringify(content.config, null, 2)}`
      }
    } else {
      text = `Config "${content.key}" set to: ${JSON.stringify(content.value, null, 2)}`
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: text,
    }
  },
})

export { CONFIG_TOOL_NAME }
