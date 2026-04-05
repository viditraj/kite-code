/**
 * Anthropic Messages API provider using raw fetch (no SDK dependency).
 *
 * Speaks Anthropic's native Messages API format directly via HTTP.
 * Zero dependency on @anthropic-ai/sdk.
 *
 * API docs: https://docs.anthropic.com/en/api/messages
 */

import type {
  ChatRequest,
  LLMProvider,
  ProviderFeature,
  StreamEvent,
  TokenUsage,
  UnifiedMessage,
  ContentBlock,
} from './types.js'

export interface AnthropicProviderOptions {
  apiKey: string
  model?: string
  apiBaseUrl?: string
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  private apiKey: string
  private defaultModel: string
  private apiBaseUrl: string

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey
    this.defaultModel = options.model ?? 'claude-sonnet-4-20250514'
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://api.anthropic.com'
  }

  async *chat(params: ChatRequest): AsyncGenerator<StreamEvent, void, undefined> {
    const model = params.model || this.defaultModel

    // Convert to Anthropic Messages API format
    const messages = this.convertMessages(params.messages)

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: params.maxTokens,
      stream: true,
    }

    if (params.system) {
      body.system = params.system
    }

    if (params.temperature !== undefined) {
      body.temperature = params.temperature
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Accept': 'text/event-stream',
    }

    const url = `${this.apiBaseUrl}/v1/messages`

    yield { type: 'message_start', model }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      yield { type: 'error', error, message: `Connection failed: ${error.message}`, retrying: false }
      return
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      yield {
        type: 'error',
        error: new Error(`HTTP ${response.status}`),
        message: `HTTP ${response.status}: ${text.slice(0, 500)}`,
        retrying: false,
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: new Error('No response body'), message: 'No response body', retrying: false }
      return
    }

    // Parse Anthropic's SSE stream format
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentBlockIndex = -1
    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }
    let stopReason = 'end_turn'

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
            continue
          }
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue

          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }

          switch (eventType) {
            case 'message_start': {
              const msg = parsed.message as Record<string, unknown> | undefined
              if (msg?.usage) {
                const u = msg.usage as Record<string, number>
                totalUsage.inputTokens = u.input_tokens ?? 0
                totalUsage.cacheReadInputTokens = u.cache_read_input_tokens ?? 0
                totalUsage.cacheCreationInputTokens = u.cache_creation_input_tokens ?? 0
              }
              break
            }

            case 'content_block_start': {
              currentBlockIndex = (parsed.index as number) ?? -1
              const block = parsed.content_block as Record<string, unknown> | undefined
              if (block?.type === 'tool_use') {
                yield {
                  type: 'tool_use_start',
                  id: (block.id as string) ?? '',
                  name: (block.name as string) ?? '',
                }
              }
              break
            }

            case 'content_block_delta': {
              const delta = parsed.delta as Record<string, unknown> | undefined
              if (!delta) break

              if (delta.type === 'text_delta') {
                yield { type: 'text_delta', text: (delta.text as string) ?? '' }
              } else if (delta.type === 'input_json_delta') {
                yield {
                  type: 'tool_use_delta',
                  id: '', // Anthropic doesn't repeat the ID in deltas
                  inputDelta: (delta.partial_json as string) ?? '',
                }
              } else if (delta.type === 'thinking_delta') {
                yield { type: 'thinking_delta', text: (delta.thinking as string) ?? '' }
              }
              break
            }

            case 'content_block_stop': {
              // If we had a tool_use block, emit end
              yield { type: 'tool_use_end', id: '' }
              break
            }

            case 'message_delta': {
              const delta = parsed.delta as Record<string, unknown> | undefined
              if (delta?.stop_reason) {
                stopReason = delta.stop_reason as string
              }
              const usage = parsed.usage as Record<string, number> | undefined
              if (usage) {
                totalUsage.outputTokens = usage.output_tokens ?? 0
              }
              break
            }

            case 'message_stop': {
              // Stream complete
              break
            }

            case 'error': {
              const err = parsed.error as Record<string, unknown> | undefined
              yield {
                type: 'error',
                error: new Error((err?.message as string) ?? 'Unknown error'),
                message: (err?.message as string) ?? 'Unknown error',
                retrying: false,
              }
              break
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    const mappedStopReason = stopReason === 'tool_use' ? 'tool_use'
      : stopReason === 'max_tokens' ? 'max_tokens'
      : 'end_turn' as const

    yield { type: 'message_end', stopReason: mappedStopReason, usage: totalUsage }
  }

  supportsFeature(feature: ProviderFeature): boolean {
    switch (feature) {
      case 'streaming': return true
      case 'tool_use': return true
      case 'vision': return true
      case 'thinking': return true
      case 'system_message': return true
      case 'prompt_caching': return true
      case 'structured_output': return false
      default: return false
    }
  }

  private convertMessages(messages: UnifiedMessage[]): Record<string, unknown>[] {
    const result: Record<string, unknown>[] = []

    for (const msg of messages) {
      if (msg.role === 'system') continue // System messages go in the 'system' param

      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content })
        continue
      }

      const blocks = msg.content as ContentBlock[]
      const converted: Record<string, unknown>[] = []

      for (const block of blocks) {
        switch (block.type) {
          case 'text':
            converted.push({ type: 'text', text: block.text })
            break
          case 'tool_use':
            converted.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
            break
          case 'tool_result': {
            const content = typeof block.content === 'string' ? block.content
              : Array.isArray(block.content) ? block.content.map(c => {
                  if (c.type === 'text') return { type: 'text', text: c.text }
                  return c
                })
              : ''
            converted.push({
              type: 'tool_result',
              tool_use_id: block.tool_use_id,
              content,
              ...(block.is_error ? { is_error: true } : {}),
            })
            break
          }
          case 'image':
            converted.push({
              type: 'image',
              source: block.source,
            })
            break
          case 'thinking':
            converted.push({ type: 'thinking', thinking: block.thinking })
            break
        }
      }

      if (converted.length > 0) {
        result.push({ role: msg.role, content: converted })
      }
    }

    return result
  }
}
