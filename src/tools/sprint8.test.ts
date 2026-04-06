import { describe, it, expect } from 'vitest'
import { AgentTool, AGENT_TOOL_NAME } from './AgentTool/AgentTool.js'
import { TodoWriteTool, TODO_WRITE_TOOL_NAME } from './TodoWriteTool/TodoWriteTool.js'
import { AskUserQuestionTool, ASK_USER_QUESTION_TOOL_NAME } from './AskUserQuestionTool/AskUserQuestionTool.js'
import { NotebookEditTool, NOTEBOOK_EDIT_TOOL_NAME } from './NotebookEditTool/NotebookEditTool.js'
import { ToolSearchTool, TOOL_SEARCH_TOOL_NAME, isDeferredTool } from './ToolSearchTool/ToolSearchTool.js'
import { MCPTool, MCP_TOOL_PREFIX, createMCPTool } from './MCPTool/MCPTool.js'
import { WebSearchTool, WEB_SEARCH_TOOL_NAME } from './WebSearchTool/WebSearchTool.js'
import { EnterPlanModeTool, ExitPlanModeTool, ENTER_PLAN_MODE_TOOL_NAME, EXIT_PLAN_MODE_TOOL_NAME } from './PlanModeTool/PlanModeTool.js'
import {
  TaskCreateTool, TaskGetTool, TaskListTool, TaskUpdateTool, TaskStopTool, TaskOutputTool,
  TASK_CREATE_TOOL_NAME, TASK_GET_TOOL_NAME, TASK_LIST_TOOL_NAME, TASK_UPDATE_TOOL_NAME,
  TASK_STOP_TOOL_NAME, TASK_OUTPUT_TOOL_NAME,
} from './TaskTools/TaskTools.js'
import type { ToolUseContext } from '../Tool.js'

// ============================================================================
// Helpers
// ============================================================================

function mockContext(appState: Record<string, unknown> = {}): ToolUseContext {
  const state = { ...appState }
  // Provide a mock provider so tools that need it (AgentTool, WebSearchTool) can function
  if (!state._provider) {
    state._provider = {
      name: 'mock',
      async *chat() {
        yield { type: 'message_start', model: 'mock' }
        yield { type: 'text_delta', text: 'Mock agent response.' }
        yield { type: 'message_end', stopReason: 'end_turn' }
      },
      supportsFeature: () => true,
    }
  }
  return {
    abortController: new AbortController(),
    options: { tools: [], commands: [], debug: false, verbose: false, mainLoopModel: 'mock', isNonInteractiveSession: true },
    messages: [],
    getCwd: () => '/tmp',
    getAppState: () => state,
    setAppState: (f) => { Object.assign(state, f(state)) },
    readFileState: { has: () => false, get: () => undefined, set: () => {} },
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
  }
}

// ============================================================================
// AgentTool
// ============================================================================

describe('AgentTool', () => {
  it('has correct name', () => {
    expect(AgentTool.name).toBe(AGENT_TOOL_NAME)
    expect(AGENT_TOOL_NAME).toBe('Agent')
  })

  it('is not read-only (writes state for background agents)', () => {
    expect(AgentTool.isReadOnly({})).toBe(false)
    expect(AgentTool.isConcurrencySafe({})).toBe(false)
  })

  it('launches async agent', async () => {
    const ctx = mockContext()
    const result = await AgentTool.call(
      { description: 'test', prompt: 'do something', run_in_background: true },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.status).toBe('async_launched')
    expect(result.data.agentId).toBeTruthy()
  })

  it('runs sync agent', async () => {
    const ctx = mockContext()
    const result = await AgentTool.call(
      { description: 'test', prompt: 'do something' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.status).toBe('completed')
  })

  it('maps async result correctly', () => {
    const mapped = AgentTool.mapToolResultToToolResultBlockParam(
      { status: 'async_launched', agentId: 'abc', agentType: 'general-purpose', description: 'test', prompt: 'do something' },
      'tu-1',
    )
    expect(mapped.content).toContain('launched in background')
    expect(mapped.tool_use_id).toBe('tu-1')
  })
})

// ============================================================================
// TodoWriteTool
// ============================================================================

describe('TodoWriteTool', () => {
  it('has correct name', () => {
    expect(TodoWriteTool.name).toBe(TODO_WRITE_TOOL_NAME)
  })

  it('stores todos in app state', async () => {
    const ctx = mockContext({})
    const result = await TodoWriteTool.call(
      { todos: [{ id: '1', content: 'Test task', status: 'pending' }] },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.newTodos).toHaveLength(1)
  })

  it('auto-allows permissions', async () => {
    const result = await TodoWriteTool.checkPermissions(
      { todos: [] }, mockContext(),
    )
    expect(result.behavior).toBe('allow')
  })
})

// ============================================================================
// AskUserQuestionTool
// ============================================================================

describe('AskUserQuestionTool', () => {
  it('has correct name', () => {
    expect(AskUserQuestionTool.name).toBe(ASK_USER_QUESTION_TOOL_NAME)
  })

  it('requires user interaction', () => {
    expect(AskUserQuestionTool.requiresUserInteraction?.()).toBe(true)
  })

  it('is read-only', () => {
    expect(AskUserQuestionTool.isReadOnly({})).toBe(true)
  })

  it('returns passthrough answers', async () => {
    const ctx = mockContext()
    const result = await AskUserQuestionTool.call(
      {
        questions: [{ question: 'Pick one', header: 'Choice', options: [{ label: 'A', description: 'Option A' }, { label: 'B', description: 'Option B' }] }],
        answers: { 'Pick one': { selected: ['A'] } },
      },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.answers['Pick one']).toBeDefined()
  })
})

// ============================================================================
// NotebookEditTool
// ============================================================================

describe('NotebookEditTool', () => {
  it('has correct name', () => {
    expect(NotebookEditTool.name).toBe(NOTEBOOK_EDIT_TOOL_NAME)
  })

  it('is not read-only', () => {
    expect(NotebookEditTool.isReadOnly({})).toBe(false)
  })

  it('is deferred', () => {
    expect(NotebookEditTool.shouldDefer).toBe(true)
  })
})

// ============================================================================
// ToolSearchTool
// ============================================================================

describe('ToolSearchTool', () => {
  it('has correct name', () => {
    expect(ToolSearchTool.name).toBe(TOOL_SEARCH_TOOL_NAME)
  })

  it('is read-only and concurrency-safe', () => {
    expect(ToolSearchTool.isReadOnly({})).toBe(true)
    expect(ToolSearchTool.isConcurrencySafe({})).toBe(true)
  })

  it('isDeferredTool detects deferred tools', () => {
    expect(isDeferredTool({ shouldDefer: true } as any)).toBe(true)
    expect(isDeferredTool({ isMcp: true } as any)).toBe(true)
    expect(isDeferredTool({ isMcp: true, alwaysLoad: true } as any)).toBe(false)
    expect(isDeferredTool({} as any)).toBe(false)
  })
})

// ============================================================================
// MCPTool
// ============================================================================

describe('MCPTool', () => {
  it('has correct prefix', () => {
    expect(MCP_TOOL_PREFIX).toBe('mcp__')
  })

  it('creates MCP tools via factory', () => {
    const tool = createMCPTool({
      serverName: 'test',
      toolName: 'hello',
      description: 'A test tool',
      inputJsonSchema: { type: 'object' },
      execute: async () => 'result',
    })
    expect(tool.name).toBe('mcp__test__hello')
    expect(tool.isMcp).toBe(true)
    expect(tool.mcpInfo).toEqual({ serverName: 'test', toolName: 'hello' })
  })

  it('factory tool executes', async () => {
    const tool = createMCPTool({
      serverName: 's', toolName: 't', description: 'd',
      inputJsonSchema: { type: 'object' },
      execute: async (input) => `got: ${JSON.stringify(input)}`,
    })
    const result = await tool.call({ foo: 'bar' }, mockContext(), async () => ({ behavior: 'allow' }), {})
    expect(result.data).toContain('got:')
  })
})

// ============================================================================
// WebSearchTool
// ============================================================================

describe('WebSearchTool', () => {
  it('has correct name', () => {
    expect(WebSearchTool.name).toBe(WEB_SEARCH_TOOL_NAME)
  })

  it('is read-only and deferred', () => {
    expect(WebSearchTool.isReadOnly({})).toBe(true)
    expect(WebSearchTool.shouldDefer).toBe(true)
  })

  it('validates against conflicting domains', async () => {
    const result = await WebSearchTool.validateInput!(
      { query: 'test', allowed_domains: ['a.com'], blocked_domains: ['b.com'] },
      mockContext(),
    )
    expect(result.result).toBe(false)
  })
})

// ============================================================================
// PlanModeTool
// ============================================================================

describe('PlanModeTool', () => {
  it('has correct names', () => {
    expect(EnterPlanModeTool.name).toBe(ENTER_PLAN_MODE_TOOL_NAME)
    expect(ExitPlanModeTool.name).toBe(EXIT_PLAN_MODE_TOOL_NAME)
  })

  it('both are read-only and deferred', () => {
    expect(EnterPlanModeTool.isReadOnly({})).toBe(true)
    expect(ExitPlanModeTool.isReadOnly({})).toBe(true)
    expect(EnterPlanModeTool.shouldDefer).toBe(true)
    expect(ExitPlanModeTool.shouldDefer).toBe(true)
  })

  it('ExitPlanMode requires user interaction', () => {
    expect(ExitPlanModeTool.requiresUserInteraction?.()).toBe(true)
  })
})

// ============================================================================
// TaskTools
// ============================================================================

describe('TaskTools', () => {
  it('all have correct names', () => {
    expect(TaskCreateTool.name).toBe(TASK_CREATE_TOOL_NAME)
    expect(TaskGetTool.name).toBe(TASK_GET_TOOL_NAME)
    expect(TaskListTool.name).toBe(TASK_LIST_TOOL_NAME)
    expect(TaskUpdateTool.name).toBe(TASK_UPDATE_TOOL_NAME)
    expect(TaskStopTool.name).toBe(TASK_STOP_TOOL_NAME)
    expect(TaskOutputTool.name).toBe(TASK_OUTPUT_TOOL_NAME)
  })

  it('TaskGet and TaskList are read-only', () => {
    expect(TaskGetTool.isReadOnly({})).toBe(true)
    expect(TaskListTool.isReadOnly({})).toBe(true)
    expect(TaskOutputTool.isReadOnly({})).toBe(true)
  })

  it('TaskCreate creates a task', async () => {
    const ctx = mockContext({})
    const result = await TaskCreateTool.call(
      { subject: 'Test', description: 'A test task' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.task.id).toBeTruthy()
    expect(result.data.task.subject).toBe('Test')
  })

  it('TaskList returns created tasks', async () => {
    const ctx = mockContext({})
    await TaskCreateTool.call(
      { subject: 'Task 1', description: 'First' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    await TaskCreateTool.call(
      { subject: 'Task 2', description: 'Second' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    const listResult = await TaskListTool.call(
      {} as any, ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(listResult.data.tasks.length).toBe(2)
  })

  it('TaskUpdate modifies a task', async () => {
    const ctx = mockContext({})
    const createResult = await TaskCreateTool.call(
      { subject: 'Original', description: 'Desc' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    const taskId = createResult.data.task.id

    const updateResult = await TaskUpdateTool.call(
      { taskId, subject: 'Updated', status: 'in_progress' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(updateResult.data.success).toBe(true)
    expect(updateResult.data.updatedFields).toContain('subject')
    expect(updateResult.data.updatedFields).toContain('status')
  })

  it('TaskUpdate returns error for missing task', async () => {
    const ctx = mockContext({})
    const result = await TaskUpdateTool.call(
      { taskId: 'nonexistent', subject: 'X' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('not found')
  })

  it('TaskGet retrieves a task', async () => {
    const ctx = mockContext({})
    const createResult = await TaskCreateTool.call(
      { subject: 'Fetch me', description: 'Desc' },
      ctx, async () => ({ behavior: 'allow' }), {},
    )
    const taskId = createResult.data.task.id

    const getResult = await TaskGetTool.call(
      { taskId }, ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(getResult.data.task).not.toBeNull()
    expect(getResult.data.task!.subject).toBe('Fetch me')
  })

  it('TaskGet returns null for missing task', async () => {
    const ctx = mockContext({})
    const result = await TaskGetTool.call(
      { taskId: 'missing' }, ctx, async () => ({ behavior: 'allow' }), {},
    )
    expect(result.data.task).toBeNull()
  })
})
