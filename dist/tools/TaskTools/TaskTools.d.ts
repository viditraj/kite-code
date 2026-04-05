/**
 * Task management tools — CRUD operations for task lists.
 *
 * Implements the same patterns as Claude Code's Task tools:
 * - TaskCreate: Create a new task
 * - TaskGet: Retrieve a task by ID
 * - TaskList: List all tasks
 * - TaskUpdate: Update a task's fields
 * - TaskStop: Stop a running background task
 * - TaskOutput: Read output from a background task
 *
 * Tasks are stored in app state and keyed by task list ID.
 */
import { z } from 'zod';
export declare const TASK_CREATE_TOOL_NAME = "TaskCreate";
export declare const TASK_GET_TOOL_NAME = "TaskGet";
export declare const TASK_LIST_TOOL_NAME = "TaskList";
export declare const TASK_UPDATE_TOOL_NAME = "TaskUpdate";
export declare const TASK_STOP_TOOL_NAME = "TaskStop";
export declare const TASK_OUTPUT_TOOL_NAME = "TaskOutput";
export declare const TaskCreateTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const TaskGetTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const TaskListTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const TaskUpdateTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const TaskStopTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export declare const TaskOutputTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=TaskTools.d.ts.map