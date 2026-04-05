/**
 * ScheduleCronTool — Create, list, and delete cron-like scheduled tasks.
 *
 * Provides three tools:
 * - ScheduleCronCreate: Store a cron configuration in appState
 * - ScheduleCronList: Return all stored cron configurations
 * - ScheduleCronDelete: Remove a cron configuration by ID
 *
 * All cron data is stored in appState.crons as an array.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const SCHEDULE_CRON_CREATE_NAME = "ScheduleCronCreate";
declare const SCHEDULE_CRON_LIST_NAME = "ScheduleCronList";
declare const SCHEDULE_CRON_DELETE_NAME = "ScheduleCronDelete";
export declare const ScheduleCronCreate: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const ScheduleCronList: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const ScheduleCronDelete: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { SCHEDULE_CRON_CREATE_NAME, SCHEDULE_CRON_LIST_NAME, SCHEDULE_CRON_DELETE_NAME, };
//# sourceMappingURL=ScheduleCronTool.d.ts.map