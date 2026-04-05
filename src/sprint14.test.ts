import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateSessionId,
  generateSessionTitle,
  createSession,
  appendMessage,
  loadSession,
  listSessions,
  deleteSession,
  getSessionsDir,
  saveSessionState,
  getRecentSessionTitles,
  exportSessionToMarkdown,
  cleanupOldSessions,
  type SessionMetadata,
} from './utils/session.js'
import type { UnifiedMessage } from './providers/types.js'

describe('Sprint 14 - Session Persistence', () => {
  describe('generateSessionId', () => {
    it('returns 8-character string', () => {
      const id = generateSessionId()
      expect(id.length).toBe(8)
      expect(typeof id).toBe('string')
    })

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('generateSessionTitle', () => {
    it('extracts title from first user message', () => {
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Help me fix the login bug' },
        { role: 'assistant', content: 'Sure, let me look at that.' },
      ]
      const title = generateSessionTitle(messages)
      expect(title).toContain('Help me fix the login bug')
    })

    it('truncates long titles', () => {
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'x'.repeat(200) },
      ]
      const title = generateSessionTitle(messages)
      expect(title.length).toBeLessThanOrEqual(85) // 80 + possible "..."
    })

    it('returns Untitled for empty messages', () => {
      expect(generateSessionTitle([])).toBe('Untitled session')
    })

    it('returns Untitled for no user messages', () => {
      const messages: UnifiedMessage[] = [
        { role: 'assistant', content: 'Hello' },
      ]
      expect(generateSessionTitle(messages)).toBe('Untitled session')
    })
  })

  describe('Session CRUD', () => {
    let sessionId: string

    it('creates a session', () => {
      const metadata = createSession('test-model', '/tmp/test')
      sessionId = metadata.id
      expect(metadata.id).toBeTruthy()
      expect(metadata.model).toBe('test-model')
      expect(metadata.cwd).toBe('/tmp/test')
      expect(metadata.messageCount).toBe(0)
      expect(metadata.createdAt).toBeGreaterThan(0)
    })

    it('appends messages', () => {
      const msg: UnifiedMessage = { role: 'user', content: 'Hello world' }
      appendMessage(sessionId, msg)

      const msg2: UnifiedMessage = { role: 'assistant', content: 'Hi there!' }
      appendMessage(sessionId, msg2)
    })

    it('loads a session', () => {
      const session = loadSession(sessionId)
      expect(session).not.toBeNull()
      expect(session!.metadata.id).toBe(sessionId)
      expect(session!.messages.length).toBe(2)
      expect(session!.messages[0]!.role).toBe('user')
      expect(session!.messages[1]!.role).toBe('assistant')
    })

    it('lists sessions', () => {
      const sessions = listSessions()
      expect(sessions.length).toBeGreaterThan(0)
      const found = sessions.find(s => s.id === sessionId)
      expect(found).toBeDefined()
    })

    it('saves session state', () => {
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Updated message' },
      ]
      saveSessionState(sessionId, messages, { title: 'Updated title' })

      const reloaded = loadSession(sessionId)
      expect(reloaded).not.toBeNull()
      expect(reloaded!.metadata.title).toBe('Updated title')
      expect(reloaded!.messages.length).toBe(1)
    })

    it('exports to markdown', () => {
      const md = exportSessionToMarkdown(sessionId)
      expect(md).not.toBeNull()
      expect(md).toContain('Updated message')
    })

    it('gets recent session titles', () => {
      const titles = getRecentSessionTitles()
      expect(titles.length).toBeGreaterThan(0)
      expect(titles[0]!.id).toBeTruthy()
      expect(titles[0]!.title).toBeTruthy()
      expect(titles[0]!.date).toBeTruthy()
    })

    it('deletes a session', () => {
      const deleted = deleteSession(sessionId)
      expect(deleted).toBe(true)

      const reloaded = loadSession(sessionId)
      expect(reloaded).toBeNull()
    })

    it('returns null for non-existent session', () => {
      expect(loadSession('nonexistent-id')).toBeNull()
    })

    it('delete returns false for non-existent session', () => {
      expect(deleteSession('nonexistent-id')).toBe(false)
    })
  })

  describe('getSessionsDir', () => {
    it('returns a path containing .kite/sessions', () => {
      const dir = getSessionsDir()
      expect(dir).toContain('.kite')
      expect(dir).toContain('sessions')
    })
  })

  describe('cleanupOldSessions', () => {
    it('returns number of deleted sessions', () => {
      const count = cleanupOldSessions()
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('Sprint 14 - Doctor Screen', () => {
  it('exports Doctor component', async () => {
    const mod = await import('./screens/Doctor.js')
    expect(mod.Doctor).toBeDefined()
  })
})

describe('Sprint 14 - Resume Screen', () => {
  it('exports ResumeConversation component', async () => {
    const mod = await import('./screens/ResumeConversation.js')
    expect(mod.ResumeConversation).toBeDefined()
  })
})
