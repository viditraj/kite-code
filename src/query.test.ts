import { describe, it, expect, vi } from 'vitest'
import { query } from './query.js'
import type { QueryParams, QueryEvent, Terminal } from './query/deps.js'
import type { StreamEvent, UnifiedMessage, ContentBlock, LLMProvider, ChatRequest } from './providers/types.js'
import type { ToolUseContext, CanUseToolFn, Tool, Tools, PermissionResult } from './Tool.js'
import { buildTool } from './Tool.js'
import { z } from 'zod'

// ============================================================================
// Test Helpers
// ============================================================================

function createMockProvider(events: StreamEvent[]): LLMProvider {
  return {
    name: 'mock',
    async *chat(_params: ChatRequest) {
      for (const event of events) {
        yield event
      }
    },
    supportsFeature: () => true,
  }
}

function createMockToolUseContext(): ToolUseContext {
  return {
    abortController: new AbortController(),
    options: {
      tools: [],
      commands: [],
      debug: false,
      verbose: false,
      mainLoopModel: 'mock',
      isNonInteractiveSession: true,
    },
    messages: [],
    getCwd: () => '/tmp',
    getAppState: () => ({}),
    setAppState: () => {},
    readFileState: {
      has: () => false,
      get: () => undefined,
      set: () => {},
    },
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
  }
}

const allowAll: CanUseToolFn = async () => ({ behavior: 'allow' })

function createEchoTool(): Tool {
  return buildTool({
    name: 'Echo',
    inputSchema: z.object({ text: z.string() }).strict(),
    maxResultSizeChars: 10000,
    isConcurrencySafe: () => true,
    isReadOnly: () => true,
    async call(args) {
      return { data: `Echo: ${args.text}` }
    },
    async description() { return 'Echoes back input' },
    async prompt() { return 'Use Echo to repeat text.' },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseID,
        content: String(content),
      }
    },
  })
}

async function collectEvents(gen: AsyncGenerator<QueryEvent, Terminal, undefined>): Promise<{
  events: QueryEvent[]
  terminal: Terminal
}> {
  const events: QueryEvent[] = []
  let result = await gen.next()
  while (!result.done) {
    events.push(result.value)
    result = await gen.next()
  }
  return { events, terminal: result.value }
}

// ============================================================================
// Tests
// ============================================================================

describe('query', () => {
  it('completes a simple text response', async () => {
    const provider = createMockProvider([
      { type: 'message_start', model: 'mock', usage: { inputTokens: 10, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } },
      { type: 'text_delta', text: 'Hello ' },
      { type: 'text_delta', text: 'world' },
      { type: 'message_end', stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } },
    ])

    const { events, terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'You are helpful.',
      tools: [],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('completed')
    const textDeltas = events.filter(e => e.type === 'text_delta')
    expect(textDeltas.length).toBe(2)
  })

  it('executes tool calls and loops', async () => {
    const echoTool = createEchoTool()
    let callCount = 0

    const provider: LLMProvider = {
      name: 'mock',
      async *chat(_params) {
        callCount++
        if (callCount === 1) {
          // First call: use a tool
          yield { type: 'message_start', model: 'mock' }
          yield { type: 'text_delta', text: 'Let me echo.' }
          yield { type: 'tool_use_start', id: 'tu-1', name: 'Echo' }
          yield { type: 'tool_use_delta', id: 'tu-1', inputDelta: '{"text":"hello"}' }
          yield { type: 'tool_use_end', id: 'tu-1' }
          yield { type: 'message_end', stopReason: 'tool_use' }
        } else {
          // Second call: end
          yield { type: 'message_start', model: 'mock' }
          yield { type: 'text_delta', text: 'Done!' }
          yield { type: 'message_end', stopReason: 'end_turn' }
        }
      },
      supportsFeature: () => true,
    }

    const { events, terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Echo something' }],
      systemPrompt: 'You are helpful.',
      tools: [echoTool],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('completed')
    expect(callCount).toBe(2)

    // Should have tool execution events (from StreamingToolExecutor)
    const toolResults = events.filter(e =>
      e.type === 'tool_result' && ('result' in e || 'toolName' in e),
    )
    expect(toolResults.length).toBeGreaterThanOrEqual(1)
    // The executor yields { type: 'tool_result', result: { toolName: 'Echo', ... } }
    const first = toolResults[0] as any
    const toolName = first.toolName ?? first.result?.toolName
    expect(toolName).toBe('Echo')
  })

  it('respects maxTurns limit', async () => {
    // Provider always requests tools (infinite loop)
    const provider: LLMProvider = {
      name: 'mock',
      async *chat() {
        yield { type: 'message_start', model: 'mock' }
        yield { type: 'tool_use_start', id: `tu-${Date.now()}`, name: 'Echo' }
        yield { type: 'tool_use_delta', id: `tu-${Date.now()}`, inputDelta: '{"text":"loop"}' }
        yield { type: 'tool_use_end', id: `tu-${Date.now()}` }
        yield { type: 'message_end', stopReason: 'tool_use' }
      },
      supportsFeature: () => true,
    }

    const echoTool = createEchoTool()
    const { terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Loop forever' }],
      systemPrompt: '',
      tools: [echoTool],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
      maxTurns: 2,
    }))

    expect(terminal.reason).toBe('max_turns')
  })

  it('handles permission denial', async () => {
    const echoTool = createEchoTool()

    const provider: LLMProvider = {
      name: 'mock',
      async *chat(_params) {
        yield { type: 'message_start', model: 'mock' }
        yield { type: 'tool_use_start', id: 'tu-1', name: 'Echo' }
        yield { type: 'tool_use_delta', id: 'tu-1', inputDelta: '{"text":"denied"}' }
        yield { type: 'tool_use_end', id: 'tu-1' }
        yield { type: 'message_end', stopReason: 'tool_use' }
      },
      supportsFeature: () => true,
    }

    const denyAll: CanUseToolFn = async () => ({
      behavior: 'deny',
      message: 'Not allowed',
    })

    // Tool denied → error result injected → next LLM call should happen
    // but for this test we just check that denial produces a tool_result event
    let secondCallMessages: UnifiedMessage[] = []
    let callCount = 0
    const trackingProvider: LLMProvider = {
      name: 'mock',
      async *chat(params) {
        callCount++
        if (callCount === 1) {
          yield* provider.chat(params)
        } else {
          secondCallMessages = params.messages
          yield { type: 'message_start', model: 'mock' }
          yield { type: 'text_delta', text: 'OK, skipped.' }
          yield { type: 'message_end', stopReason: 'end_turn' }
        }
      },
      supportsFeature: () => true,
    }

    const { events, terminal } = await collectEvents(query({
      provider: trackingProvider,
      messages: [{ role: 'user', content: 'Echo something' }],
      systemPrompt: '',
      tools: [echoTool],
      toolUseContext: createMockToolUseContext(),
      canUseTool: denyAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('completed')
    // The denied tool should appear as an error result event
    const deniedResults = events.filter(
      e => e.type === 'tool_result' && (e as any).isError,
    )
    expect(deniedResults.length).toBe(1)
  })

  it('handles abort during streaming', async () => {
    const abortController = new AbortController()

    const provider: LLMProvider = {
      name: 'mock',
      async *chat() {
        yield { type: 'message_start', model: 'mock' }
        yield { type: 'text_delta', text: 'Starting...' }
        // Abort after first delta
        abortController.abort('user')
        yield { type: 'text_delta', text: 'More text' }
        yield { type: 'message_end', stopReason: 'end_turn' }
      },
      supportsFeature: () => true,
    }

    const context = createMockToolUseContext()
    context.abortController = abortController

    const { terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Go' }],
      systemPrompt: '',
      tools: [],
      toolUseContext: context,
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('aborted_streaming')
  })

  it('handles unknown tool gracefully', async () => {
    const provider: LLMProvider = {
      name: 'mock',
      async *chat(_params) {
        const callNum = _params.messages.length
        if (callNum <= 1) {
          yield { type: 'message_start', model: 'mock' }
          yield { type: 'tool_use_start', id: 'tu-1', name: 'NonExistentTool' }
          yield { type: 'tool_use_delta', id: 'tu-1', inputDelta: '{}' }
          yield { type: 'tool_use_end', id: 'tu-1' }
          yield { type: 'message_end', stopReason: 'tool_use' }
        } else {
          yield { type: 'message_start', model: 'mock' }
          yield { type: 'text_delta', text: 'Tool not found, done.' }
          yield { type: 'message_end', stopReason: 'end_turn' }
        }
      },
      supportsFeature: () => true,
    }

    const { events, terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Use a fake tool' }],
      systemPrompt: '',
      tools: [],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('completed')
    // Should have an error tool result for the unknown tool
    // The query loop yields QueryEvent { type: 'tool_result', toolUseId, toolName, output, isError }
    // for unknown tools (not via executor)
    const errorResults = events.filter(
      e => e.type === 'tool_result' && (
        (e as any).isError === true ||
        ((e as any).result && (e as any).result.isError === true)
      ),
    )
    expect(errorResults.length).toBeGreaterThanOrEqual(1)
  })

  it('handles max_output_tokens recovery', async () => {
    let callCount = 0
    const provider: LLMProvider = {
      name: 'mock',
      async *chat() {
        callCount++
        yield { type: 'message_start', model: 'mock' }
        if (callCount === 1) {
          yield { type: 'text_delta', text: 'Partial response...' }
          yield { type: 'message_end', stopReason: 'max_tokens' }
        } else {
          yield { type: 'text_delta', text: 'Continued response.' }
          yield { type: 'message_end', stopReason: 'end_turn' }
        }
      },
      supportsFeature: () => true,
    }

    const { events, terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Write a long essay' }],
      systemPrompt: '',
      tools: [],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('completed')
    expect(callCount).toBe(2)

    // Should have a recovery event
    const recoveries = events.filter(e => e.type === 'recovery')
    expect(recoveries.length).toBe(1)
    expect((recoveries[0] as any).reason).toBe('max_output_tokens_recovery')
  })

  it('handles model errors', async () => {
    const provider: LLMProvider = {
      name: 'mock',
      async *chat() {
        yield { type: 'message_start', model: 'mock' }
        throw new Error('Server error')
      },
      supportsFeature: () => true,
    }

    const { terminal } = await collectEvents(query({
      provider,
      messages: [{ role: 'user', content: 'Go' }],
      systemPrompt: '',
      tools: [],
      toolUseContext: createMockToolUseContext(),
      canUseTool: allowAll,
      permissionContext: {
        mode: 'default',
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      model: 'mock',
      maxTokens: 4096,
    }))

    expect(terminal.reason).toBe('model_error')
    expect((terminal as any).error.message).toBe('Server error')
  })
})
