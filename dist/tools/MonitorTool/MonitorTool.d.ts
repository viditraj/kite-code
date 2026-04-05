/**
 * MonitorTool — System monitoring using OS module and shell commands.
 *
 * Reports system metrics:
 * - cpu: CPU info and load averages
 * - memory: Total, free, and used memory
 * - disk: Disk usage via `df -h`
 * - all: All of the above
 *
 * Auto-allowed, read-only.
 */
import { z } from 'zod';
declare const MONITOR_TOOL_NAME = "Monitor";
export declare const MonitorTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { MONITOR_TOOL_NAME };
//# sourceMappingURL=MonitorTool.d.ts.map