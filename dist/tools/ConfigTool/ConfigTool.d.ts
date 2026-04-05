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
declare const CONFIG_TOOL_NAME = "Config";
export declare const ConfigTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { CONFIG_TOOL_NAME };
//# sourceMappingURL=ConfigTool.d.ts.map