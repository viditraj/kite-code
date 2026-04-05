/**
 * TodoWriteTool — Manage the session task checklist.
 *
 * Matches Claude Code's TodoWriteTool pattern:
 * - Items have content, status, and id
 * - Stores state in appState.todos keyed by agentId
 * - Clears list when all items are completed
 * - Auto-allowed (no permission prompt)
 * - Resilient input handling: normalizes malformed LLM inputs
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import { randomUUID } from 'crypto'

export const TODO_WRITE_TOOL_NAME = 'TodoWrite'

// ============================================================================
// Schema — kept flexible to handle various LLM output formats
// ============================================================================

const TodoItemSchema = z.object({
  id: z.string().optional().describe('Unique identifier for the todo item.'),
  content: z.string().min(1).describe('The task description.'),
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Current status of the todo item.'),
})

// Accept ANY input shape — the normalizeTodos function handles everything
const inputSchema = z.object({}).passthrough()

interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface TodoWriteOutput {
  oldTodos: TodoItem[]
  newTodos: TodoItem[]
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u2610',
  in_progress: '\u27F3',
  completed: '\u2713',
}

// ============================================================================
// Normalize LLM input into proper TodoItem[]
// Handles: bare strings, objects missing fields, wrong types
// ============================================================================

function normalizeTodos(raw: unknown[]): TodoItem[] {
  const result: TodoItem[] = []
  let counter = 1

  for (const item of raw) {
    if (typeof item === 'string') {
      // Bare string → create a pending todo
      result.push({
        id: String(counter++),
        content: item,
        status: 'pending',
      })
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const content = (obj.content ?? obj.text ?? obj.task ?? obj.description ?? obj.title ?? '') as string
      if (!content) continue
      const status = (['pending', 'in_progress', 'completed'].includes(obj.status as string)
        ? obj.status
        : 'pending') as TodoItem['status']
      result.push({
        id: (obj.id as string) ?? String(counter++),
        content: String(content),
        status,
      })
    }
  }

  return result
}

// ============================================================================
// Tool definition
// ============================================================================

export const TodoWriteTool = buildTool({
  name: TODO_WRITE_TOOL_NAME,
  searchHint: 'manage the session task checklist',
  maxResultSizeChars: 100_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return false
  },

  async description() {
    return 'Update the todo list for the current session.'
  },

  async prompt() {
    return `Use this tool to create and manage a structured task list for your current coding session.

The input must be a JSON object with a "todos" array. Each item in the array must be an object with:
- "id": unique string identifier (e.g. "1", "2", "task-1")
- "content": the task description string
- "status": one of "pending", "in_progress", or "completed"

Example:
{
  "todos": [
    {"id": "1", "content": "Read the source file", "status": "completed"},
    {"id": "2", "content": "Fix the bug", "status": "in_progress"},
    {"id": "3", "content": "Write tests", "status": "pending"}
  ]
}

Use this tool proactively for multi-step tasks (3+ steps). Mark tasks in_progress before starting, completed immediately after finishing. Only one task should be in_progress at a time.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'TodoWrite'
  },

  toAutoClassifierInput(input: Record<string, unknown>) {
    const t = input.todos
    return `todo write ${Array.isArray(t) ? t.length : 0} items`
  },

  getToolUseSummary(input?: Record<string, unknown>) {
    const t = input?.todos
    if (!Array.isArray(t)) return null
    return `${t.length} todo(s)`
  },

  getActivityDescription(input?: Record<string, unknown>) {
    const t = input?.todos
    if (!Array.isArray(t)) return 'Updating todo list'
    return `Updating ${t.length} todo(s)`
  },

  async call(args: Record<string, unknown>, context: ToolUseContext) {
    const appState = context.getAppState()
    const todoKey = (context as any).agentId || 'session'
    const todosMap = (appState.todos ?? {}) as Record<string, TodoItem[]>
    const oldTodos: TodoItem[] = todosMap[todoKey] ?? []

    // Extract raw todos from whatever the LLM sent
    const raw = args.todos ?? args.items ?? args.tasks ?? args.list
    const rawArray = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : [])

    // Normalize into proper TodoItem[]
    const todos = normalizeTodos(rawArray)

    if (todos.length === 0) {
      return {
        data: {
          oldTodos,
          newTodos: [],
        } as TodoWriteOutput,
      }
    }

    const allCompleted = todos.every(t => t.status === 'completed')
    const newTodos: TodoItem[] = allCompleted ? [] : todos

    context.setAppState((prev: Record<string, unknown>) => ({
      ...prev,
      todos: {
        ...(prev.todos as Record<string, TodoItem[]> | undefined),
        [todoKey]: newTodos,
      },
    }))

    return {
      data: {
        oldTodos,
        newTodos: todos,
      } as TodoWriteOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: TodoWriteOutput, toolUseID: string) {
    let text = 'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable.'

    if (content.newTodos.length > 0) {
      text += '\nCurrent todo list:'
      content.newTodos.forEach((todo, index) => {
        const icon = STATUS_ICONS[todo.status] || '\u2610'
        text += `\n${index + 1}. [${icon}] ${todo.content} [${todo.status}]`
      })
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: text,
    }
  },
})
