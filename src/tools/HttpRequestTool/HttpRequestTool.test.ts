/**
 * Tests for HttpRequestTool.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequestTool } from './HttpRequestTool.js'

// Mock ToolUseContext
function createMockContext(): any {
  const abortController = new AbortController()
  return {
    abortController,
    options: {
      tools: [],
      commands: [],
      debug: false,
      verbose: false,
      mainLoopModel: 'mock',
      isNonInteractiveSession: true,
      refreshTools: () => [],
    },
    messages: [],
    getCwd: () => '/tmp',
    getAppState: () => ({}),
    setAppState: vi.fn(),
    readFileState: { has: () => false, get: () => undefined, set: () => {} },
    setInProgressToolUseIDs: vi.fn(),
    setResponseLength: vi.fn(),
  }
}

describe('HttpRequestTool', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(HttpRequestTool.name).toBe('HttpRequest')
    })

    it('is not read-only', () => {
      expect(HttpRequestTool.isReadOnly()).toBe(false)
    })

    it('is concurrency-safe', () => {
      expect(HttpRequestTool.isConcurrencySafe()).toBe(true)
    })

    it('provides description', async () => {
      const desc = await HttpRequestTool.description({ method: 'GET', url: 'https://example.com' } as any)
      expect(desc).toBe('GET https://example.com')
    })

    it('provides prompt', async () => {
      const prompt = await HttpRequestTool.prompt()
      expect(prompt).toContain('HTTP request')
      expect(prompt).toContain('GET')
      expect(prompt).toContain('POST')
    })
  })

  describe('validateInput', () => {
    it('accepts valid GET request', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'https://api.example.com/data',
      })
      expect(result.result).toBe(true)
    })

    it('accepts valid POST with body', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'POST',
        url: 'https://api.example.com/items',
        body: '{"name":"test"}',
      })
      expect(result.result).toBe(true)
    })

    it('rejects invalid URL', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'not-a-url',
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('Invalid URL')
    })

    it('rejects non-HTTP schemes', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'ftp://files.example.com/data',
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('Unsupported protocol')
    })

    it('rejects embedded credentials in URL', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'https://user:pass@example.com/api',
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('credentials')
    })

    it('rejects body for GET requests', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'https://api.example.com/data',
        body: '{"key":"value"}',
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('not allowed for GET')
    })

    it('rejects body for HEAD requests', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'HEAD',
        url: 'https://api.example.com/data',
        body: 'test',
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('not allowed for HEAD')
    })

    it('rejects negative timeout', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'https://api.example.com',
        timeout: -1,
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('positive')
    })

    it('rejects excessive timeout', async () => {
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: 'https://api.example.com',
        timeout: 999999,
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('maximum')
    })

    it('rejects oversized body', async () => {
      const bigBody = 'x'.repeat(6 * 1024 * 1024) // 6MB
      const result = await HttpRequestTool.validateInput({
        method: 'POST',
        url: 'https://api.example.com/upload',
        body: bigBody,
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('too large')
    })

    it('rejects overly long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(5000)
      const result = await HttpRequestTool.validateInput({
        method: 'GET',
        url: longUrl,
      })
      expect(result.result).toBe(false)
      expect(result.message).toContain('maximum length')
    })
  })

  describe('checkPermissions', () => {
    it('allows GET requests automatically', async () => {
      const result = await HttpRequestTool.checkPermissions({ method: 'GET', url: 'https://example.com' })
      expect(result.behavior).toBe('allow')
    })

    it('allows HEAD requests automatically', async () => {
      const result = await HttpRequestTool.checkPermissions({ method: 'HEAD', url: 'https://example.com' })
      expect(result.behavior).toBe('allow')
    })

    it('allows OPTIONS requests automatically', async () => {
      const result = await HttpRequestTool.checkPermissions({ method: 'OPTIONS', url: 'https://example.com' })
      expect(result.behavior).toBe('allow')
    })

    it('requires permission for POST', async () => {
      const result = await HttpRequestTool.checkPermissions({ method: 'POST', url: 'https://example.com' })
      expect(result.behavior).toBe('passthrough')
    })

    it('requires permission for DELETE', async () => {
      const result = await HttpRequestTool.checkPermissions({ method: 'DELETE', url: 'https://example.com' })
      expect(result.behavior).toBe('passthrough')
    })
  })

  describe('call', () => {
    it('handles connection errors gracefully', async () => {
      const context = createMockContext()
      const result = await HttpRequestTool.call(
        {
          method: 'GET',
          url: 'https://this-domain-does-not-exist-12345.com/api',
          timeout: 5000,
        },
        context,
        async () => ({ behavior: 'allow' }),
        undefined,
      )

      expect(result.data.error).toBeTruthy()
      expect(result.data.status).toBe(0)
      expect(result.data.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('handles abort from parent context', async () => {
      const context = createMockContext()
      // Use a URL that will hang (non-routable IP) so the abort actually interrupts
      // Abort after a short delay to ensure fetch has started
      setTimeout(() => context.abortController.abort(), 50)

      const result = await HttpRequestTool.call(
        { method: 'GET', url: 'https://10.255.255.1/hang', timeout: 10000 },
        context,
        async () => ({ behavior: 'allow' }),
        undefined,
      )

      // Should either get an abort error or a connection error
      expect(result.data.status).toBe(0)
      expect(result.data.error).toBeTruthy()
    })
  })

  describe('mapToolResultToToolResultBlockParam', () => {
    it('formats successful response', () => {
      const result = HttpRequestTool.mapToolResultToToolResultBlockParam(
        {
          url: 'https://api.example.com/data',
          method: 'GET',
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"result": "success"}',
          bodyBytes: 21,
          durationMs: 150,
          redirected: false,
          finalUrl: 'https://api.example.com/data',
          error: null,
        },
        'tu-123',
      )

      expect(result.is_error).toBe(false)
      expect(result.content).toContain('200 OK')
      expect(result.content).toContain('{"result": "success"}')
    })

    it('formats error response', () => {
      const result = HttpRequestTool.mapToolResultToToolResultBlockParam(
        {
          url: 'https://api.example.com/data',
          method: 'GET',
          status: 0,
          statusText: 'Error',
          headers: {},
          body: 'Connection refused',
          bodyBytes: 0,
          durationMs: 50,
          redirected: false,
          finalUrl: 'https://api.example.com/data',
          error: 'Connection refused: https://api.example.com/data',
        },
        'tu-456',
      )

      expect(result.is_error).toBe(true)
      expect(result.content).toContain('Connection refused')
    })

    it('formats 4xx response as error', () => {
      const result = HttpRequestTool.mapToolResultToToolResultBlockParam(
        {
          url: 'https://api.example.com/data',
          method: 'GET',
          status: 404,
          statusText: 'Not Found',
          headers: {},
          body: 'Not found',
          bodyBytes: 9,
          durationMs: 100,
          redirected: false,
          finalUrl: 'https://api.example.com/data',
          error: null,
        },
        'tu-789',
      )

      expect(result.is_error).toBe(true)
      expect(result.content).toContain('404')
    })

    it('shows redirect info', () => {
      const result = HttpRequestTool.mapToolResultToToolResultBlockParam(
        {
          url: 'http://example.com',
          method: 'GET',
          status: 200,
          statusText: 'OK',
          headers: {},
          body: 'hello',
          bodyBytes: 5,
          durationMs: 200,
          redirected: true,
          finalUrl: 'https://www.example.com',
          error: null,
        },
        'tu-redir',
      )

      expect(result.content).toContain('Redirected from')
      expect(result.content).toContain('http://example.com')
    })
  })

  describe('metadata helpers', () => {
    it('getToolUseSummary truncates long URLs', () => {
      const summary = HttpRequestTool.getToolUseSummary({
        method: 'GET',
        url: 'https://very-long-domain.example.com/very/long/path/that/exceeds/seventy/characters/easily/and/then/some/more',
      })
      expect(summary).toBeTruthy()
      expect(summary!.length).toBeLessThanOrEqual(80)
    })

    it('getToolUseSummary returns null without url', () => {
      const summary = HttpRequestTool.getToolUseSummary({ method: 'GET' })
      expect(summary).toBeNull()
    })

    it('userFacingName returns HttpRequest', () => {
      expect(HttpRequestTool.userFacingName()).toBe('HttpRequest')
    })
  })
})
