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

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

// ============================================================================
// Constants & Types
// ============================================================================

export const TASK_CREATE_TOOL_NAME = 'TaskCreate'
export const TASK_GET_TOOL_NAME = 'TaskGet'
export const TASK_LIST_TOOL_NAME = 'TaskList'
export const TASK_UPDATE_TOOL_NAME = 'TaskUpdate'
export const TASK_STOP_TOOL_NAME = 'TaskStop'
export const TASK_OUTPUT_TOOL_NAME = 'TaskOutput'

const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'running'])
type TaskStatus = z.infer<typeof TaskStatusSchema>

interface Task {
  id: string
  subject: string
  description: string
  status: TaskStatus
  owner?: string
  blocks: string[]
  blockedBy: string[]
  metadata?: Record<string, unknown>
  activeForm?: string
  createdAt: number
  updatedAt: number
}

function getTaskListId(): string {
  return 'default'
}

function getTasksFromState(appState: Record<string, unknown>): Record<string, Task> {
  return (appState.taskList as Record<string, Task>) ?? {}
}

function setTasksInState(
  context: ToolUseContext,
  tasks: Record<string, Task>,
): void {
  context.setAppState(prev => ({ ...prev, taskList: tasks }))
}

// ============================================================================
// TaskCreate
// ============================================================================

export const TaskCreateTool = buildTool({
  name: TASK_CREATE_TOOL_NAME,
  searchHint: 'create a task in the task list',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({
    subject: z.string().describe('A brief title for the task'),
    description: z.string().describe('What needs to be done'),
    activeForm: z.string().optional().describe('Present continuous form shown in spinner when in_progress'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Arbitrary metadata to attach'),
  }),

  isConcurrencySafe: () => true,

  async description() { return 'Create a new task' },
  async prompt() { return 'Create a new task in the task list with a subject, description, and optional metadata.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call({ subject, description, activeForm, metadata }, context: ToolUseContext) {
    const id = randomUUID().slice(0, 8)
    const now = Date.now()

    const task: Task = {
      id,
      subject,
      description,
      status: 'pending',
      blocks: [],
      blockedBy: [],
      activeForm,
      metadata,
      createdAt: now,
      updatedAt: now,
    }

    const tasks = getTasksFromState(context.getAppState())
    tasks[id] = task
    setTasksInState(context, tasks)

    return { data: { task: { id: task.id, subject: task.subject } } }
  },

  mapToolResultToToolResultBlockParam(data: { task: { id: string; subject: string } }, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Task #${data.task.id} created successfully: ${data.task.subject}`,
    }
  },
})

// ============================================================================
// TaskGet
// ============================================================================

export const TaskGetTool = buildTool({
  name: TASK_GET_TOOL_NAME,
  searchHint: 'retrieve a task by ID',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({
    taskId: z.string().describe('The ID of the task to retrieve'),
  }),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async description() { return 'Get a task by ID' },
  async prompt() { return 'Retrieve a task from the task list by its ID.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call({ taskId }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const task = tasks[taskId] ?? null
    return { data: { task } }
  },

  mapToolResultToToolResultBlockParam(data: { task: Task | null }, toolUseID: string) {
    if (!data.task) {
      return { type: 'tool_result' as const, tool_use_id: toolUseID, content: 'Task not found' }
    }
    const t = data.task
    const lines = [
      `Task #${t.id}: ${t.subject}`,
      `Status: ${t.status}`,
      `Description: ${t.description}`,
      ...(t.blockedBy.length > 0 ? [`Blocked by: ${t.blockedBy.map(id => `#${id}`).join(', ')}`] : []),
      ...(t.blocks.length > 0 ? [`Blocks: ${t.blocks.map(id => `#${id}`).join(', ')}`] : []),
    ]
    return { type: 'tool_result' as const, tool_use_id: toolUseID, content: lines.join('\n') }
  },
})

// ============================================================================
// TaskList
// ============================================================================

export const TaskListTool = buildTool({
  name: TASK_LIST_TOOL_NAME,
  searchHint: 'list all tasks',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({}),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async description() { return 'List all tasks' },
  async prompt() { return 'List all tasks in the current task list.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call(_args: Record<string, never>, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const taskArray = Object.values(tasks)
      .filter(t => !t.metadata?._internal)
      .map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        owner: t.owner,
        blockedBy: t.blockedBy.filter(bid => {
          const blocker = tasks[bid]
          return blocker && blocker.status !== 'completed'
        }),
      }))

    return { data: { tasks: taskArray } }
  },

  mapToolResultToToolResultBlockParam(
    data: { tasks: Array<{ id: string; subject: string; status: string; owner?: string; blockedBy: string[] }> },
    toolUseID: string,
  ) {
    if (data.tasks.length === 0) {
      return { type: 'tool_result' as const, tool_use_id: toolUseID, content: 'No tasks found' }
    }
    const lines = data.tasks.map(t => {
      const owner = t.owner ? ` (${t.owner})` : ''
      const blocked = t.blockedBy.length > 0
        ? ` [blocked by ${t.blockedBy.map(id => `#${id}`).join(', ')}]`
        : ''
      return `#${t.id} [${t.status}] ${t.subject}${owner}${blocked}`
    })
    return { type: 'tool_result' as const, tool_use_id: toolUseID, content: lines.join('\n') }
  },
})

// ============================================================================
// TaskUpdate
// ============================================================================

export const TaskUpdateTool = buildTool({
  name: TASK_UPDATE_TOOL_NAME,
  searchHint: 'update a task',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({
    taskId: z.string().describe('The ID of the task to update'),
    subject: z.string().optional().describe('New subject'),
    description: z.string().optional().describe('New description'),
    activeForm: z.string().optional().describe('New active form'),
    status: TaskStatusSchema.or(z.literal('deleted')).optional().describe('New status'),
    addBlocks: z.array(z.string()).optional().describe('Task IDs this task blocks'),
    addBlockedBy: z.array(z.string()).optional().describe('Task IDs that block this task'),
    owner: z.string().optional().describe('New owner'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Metadata updates'),
  }),

  isConcurrencySafe: () => true,

  async description() { return 'Update a task' },
  async prompt() { return 'Update fields of an existing task. Only specified fields are changed.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async call(input: {
    taskId: string
    subject?: string
    description?: string
    activeForm?: string
    status?: string
    addBlocks?: string[]
    addBlockedBy?: string[]
    owner?: string
    metadata?: Record<string, unknown>
  }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const task = tasks[input.taskId]

    if (!task) {
      return {
        data: {
          success: false,
          taskId: input.taskId,
          updatedFields: [] as string[],
          error: `Task #${input.taskId} not found`,
        },
      }
    }

    // Handle deletion
    if (input.status === 'deleted') {
      delete tasks[input.taskId]
      setTasksInState(context, tasks)
      return {
        data: {
          success: true,
          taskId: input.taskId,
          updatedFields: ['status (deleted)'],
          statusChange: { from: task.status, to: 'deleted' },
        },
      }
    }

    const updatedFields: string[] = []
    const oldStatus = task.status

    if (input.subject !== undefined) { task.subject = input.subject; updatedFields.push('subject') }
    if (input.description !== undefined) { task.description = input.description; updatedFields.push('description') }
    if (input.activeForm !== undefined) { task.activeForm = input.activeForm; updatedFields.push('activeForm') }
    if (input.owner !== undefined) { task.owner = input.owner; updatedFields.push('owner') }
    if (input.status !== undefined) { task.status = input.status as TaskStatus; updatedFields.push('status') }
    if (input.metadata !== undefined) {
      task.metadata = { ...task.metadata, ...input.metadata }
      updatedFields.push('metadata')
    }
    if (input.addBlocks) {
      for (const bid of input.addBlocks) {
        if (!task.blocks.includes(bid)) task.blocks.push(bid)
        const blocked = tasks[bid]
        if (blocked && !blocked.blockedBy.includes(input.taskId)) {
          blocked.blockedBy.push(input.taskId)
        }
      }
      updatedFields.push('blocks')
    }
    if (input.addBlockedBy) {
      for (const bid of input.addBlockedBy) {
        if (!task.blockedBy.includes(bid)) task.blockedBy.push(bid)
        const blocker = tasks[bid]
        if (blocker && !blocker.blocks.includes(input.taskId)) {
          blocker.blocks.push(input.taskId)
        }
      }
      updatedFields.push('blockedBy')
    }

    task.updatedAt = Date.now()
    setTasksInState(context, tasks)

    return {
      data: {
        success: true,
        taskId: input.taskId,
        updatedFields,
        ...(input.status !== undefined && oldStatus !== input.status
          ? { statusChange: { from: oldStatus, to: input.status } }
          : {}),
      },
    }
  },

  mapToolResultToToolResultBlockParam(
    data: { success: boolean; taskId: string; updatedFields: string[]; error?: string; statusChange?: { from: string; to: string } },
    toolUseID: string,
  ) {
    if (!data.success) {
      return { type: 'tool_result' as const, tool_use_id: toolUseID, content: data.error || `Task #${data.taskId} not found` }
    }
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Updated task #${data.taskId}: ${data.updatedFields.join(', ')}`,
    }
  },
})

// ============================================================================
// TaskStop
// ============================================================================

export const TaskStopTool = buildTool({
  name: TASK_STOP_TOOL_NAME,
  aliases: ['KillShell'],
  searchHint: 'kill a running background task',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({
    task_id: z.string().describe('The ID of the background task to stop'),
  }),

  isConcurrencySafe: () => true,

  async description() { return 'Stop a running background task' },
  async prompt() { return 'Stop a running background task by its ID. The task must be in a running state.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async validateInput(input: { task_id: string }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const task = tasks[input.task_id]
    if (!task) {
      return { result: false, message: `Task #${input.task_id} not found` }
    }
    if (task.status !== 'running' && task.status !== 'in_progress') {
      return { result: false, message: `Task #${input.task_id} is not running (status: ${task.status})` }
    }
    return { result: true }
  },

  async call({ task_id }: { task_id: string }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const task = tasks[task_id]!

    task.status = 'failed'
    task.updatedAt = Date.now()
    setTasksInState(context, tasks)

    return {
      data: {
        message: `Task #${task_id} has been stopped`,
        task_id,
        task_type: 'task',
        command: task.subject,
      },
    }
  },

  mapToolResultToToolResultBlockParam(
    data: { message: string; task_id: string; task_type: string; command?: string },
    toolUseID: string,
  ) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: JSON.stringify(data),
    }
  },
})

// ============================================================================
// TaskOutput
// ============================================================================

export const TaskOutputTool = buildTool({
  name: TASK_OUTPUT_TOOL_NAME,
  aliases: ['AgentOutputTool', 'BashOutputTool'],
  searchHint: 'read output/logs from a background task',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  strict: true,

  inputSchema: z.strictObject({
    task_id: z.string().describe('The task ID to get output from'),
    block: z.boolean().default(true).describe('Whether to wait for completion'),
    timeout: z.number().min(0).max(600000).default(30000).describe('Max wait time in ms'),
  }),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async description() { return 'Read output from a background task' },
  async prompt() { return 'Read output or logs from a background task. Use block=true to wait for completion, or block=false to get current state immediately.' },

  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  async validateInput(input: { task_id: string }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    if (!tasks[input.task_id]) {
      return { result: false, message: `Task #${input.task_id} not found` }
    }
    return { result: true }
  },

  async call({ task_id, block, timeout }: { task_id: string; block: boolean; timeout: number }, context: ToolUseContext) {
    const tasks = getTasksFromState(context.getAppState())
    const task = tasks[task_id]

    if (!task) {
      return {
        data: {
          retrieval_status: 'not_ready' as const,
          task: null,
        },
      }
    }

    // If not blocking, return current state
    if (!block) {
      return {
        data: {
          retrieval_status: 'success' as const,
          task: {
            task_id: task.id,
            task_type: 'task',
            status: task.status,
            description: task.subject,
            output: task.description,
          },
        },
      }
    }

    // Blocking: poll until complete or timeout
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const current = getTasksFromState(context.getAppState())[task_id]
      if (!current || current.status === 'completed' || current.status === 'failed') {
        return {
          data: {
            retrieval_status: 'success' as const,
            task: current ? {
              task_id: current.id,
              task_type: 'task',
              status: current.status,
              description: current.subject,
              output: current.description,
            } : null,
          },
        }
      }

      // Check abort
      if (context.abortController.signal.aborted) {
        break
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return {
      data: {
        retrieval_status: 'timeout' as const,
        task: {
          task_id: task.id,
          task_type: 'task',
          status: task.status,
          description: task.subject,
          output: task.description,
        },
      },
    }
  },

  mapToolResultToToolResultBlockParam(
    data: {
      retrieval_status: string
      task: { task_id: string; task_type: string; status: string; description: string; output: string } | null
    },
    toolUseID: string,
  ) {
    const parts = [
      `<retrieval_status>${data.retrieval_status}</retrieval_status>`,
    ]

    if (data.task) {
      parts.push(
        `<task_id>${data.task.task_id}</task_id>`,
        `<task_type>${data.task.task_type}</task_type>`,
        `<status>${data.task.status}</status>`,
      )
      if (data.task.output?.trim()) {
        parts.push(`<output>\n${data.task.output}\n</output>`)
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: parts.join('\n\n'),
    }
  },
})
