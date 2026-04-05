import { describe, it, expect } from 'vitest'
import { createInitialVimState, createInitialPersistentState, SIMPLE_MOTIONS, FIND_KEYS, TEXT_OBJ_TYPES, OPERATORS, isOperatorKey, isTextObjScopeKey, MAX_VIM_COUNT } from './vim/types.js'
import { resolveMotion } from './vim/motions.js'
import { resolveTextObject } from './vim/textObjects.js'
import { transition } from './vim/transitions.js'
import { isAutoMemoryEnabled, getMemoryBaseDir, sanitizePath, getAutoMemEntrypoint, getAutoMemDailyLogPath, isAutoMemPath } from './memdir/paths.js'
import { truncateEntrypointContent, ENTRYPOINT_NAME, MAX_ENTRYPOINT_LINES, MAX_ENTRYPOINT_BYTES, buildMemoryPrompt, getMemoryFiles } from './memdir/memdir.js'
import { parseFrontmatter, getSkillDirCommands, getSkillsPath, clearSkillCaches, getDynamicSkills, registerDynamicSkill } from './skills/loadSkillsDir.js'

// ============================================================================
// Vim Types
// ============================================================================

describe('Vim Types', () => {
  it('creates initial vim state in INSERT mode', () => {
    const state = createInitialVimState()
    expect(state.mode).toBe('INSERT')
    expect(state.insertedText).toBe('')
  })

  it('creates initial persistent state', () => {
    const ps = createInitialPersistentState()
    expect(ps.lastChange).toBeNull()
    expect(ps.lastFind).toBeNull()
    expect(ps.register).toBe('')
    expect(ps.registerIsLinewise).toBe(false)
  })

  it('SIMPLE_MOTIONS contains expected keys', () => {
    expect(SIMPLE_MOTIONS.has('h')).toBe(true)
    expect(SIMPLE_MOTIONS.has('j')).toBe(true)
    expect(SIMPLE_MOTIONS.has('w')).toBe(true)
    expect(SIMPLE_MOTIONS.has('$')).toBe(true)
  })

  it('OPERATORS maps keys correctly', () => {
    expect(OPERATORS.d).toBe('delete')
    expect(OPERATORS.c).toBe('change')
    expect(OPERATORS.y).toBe('yank')
  })

  it('isOperatorKey works', () => {
    expect(isOperatorKey('d')).toBe(true)
    expect(isOperatorKey('x')).toBe(false)
  })

  it('MAX_VIM_COUNT is 10000', () => {
    expect(MAX_VIM_COUNT).toBe(10000)
  })
})

// ============================================================================
// Vim Motions
// ============================================================================

describe('Vim Motions', () => {
  it('h moves left', () => {
    const result = resolveMotion('h', { lines: ['hello'], cursor: { line: 0, col: 3 } }, 1)
    expect(result!.newCursor.col).toBe(2)
  })

  it('l moves right', () => {
    const result = resolveMotion('l', { lines: ['hello'], cursor: { line: 0, col: 1 } }, 1)
    expect(result!.newCursor.col).toBe(2)
  })

  it('j moves down', () => {
    const result = resolveMotion('j', { lines: ['a', 'b'], cursor: { line: 0, col: 0 } }, 1)
    expect(result!.newCursor.line).toBe(1)
    expect(result!.linewise).toBe(true)
  })

  it('k moves up', () => {
    const result = resolveMotion('k', { lines: ['a', 'b'], cursor: { line: 1, col: 0 } }, 1)
    expect(result!.newCursor.line).toBe(0)
  })

  it('0 moves to line start', () => {
    const result = resolveMotion('0', { lines: ['hello'], cursor: { line: 0, col: 3 } }, 1)
    expect(result!.newCursor.col).toBe(0)
  })

  it('$ moves to line end', () => {
    const result = resolveMotion('$', { lines: ['hello'], cursor: { line: 0, col: 0 } }, 1)
    expect(result!.newCursor.col).toBe(4)
  })

  it('^ moves to first non-blank', () => {
    const result = resolveMotion('^', { lines: ['  hello'], cursor: { line: 0, col: 0 } }, 1)
    expect(result!.newCursor.col).toBe(2)
  })

  it('w moves to next word', () => {
    const result = resolveMotion('w', { lines: ['hello world'], cursor: { line: 0, col: 0 } }, 1)
    expect(result!.newCursor.col).toBe(6)
  })

  it('returns null for unknown motions', () => {
    expect(resolveMotion('z', { lines: ['hello'], cursor: { line: 0, col: 0 } }, 1)).toBeNull()
  })
})

// ============================================================================
// Vim Text Objects
// ============================================================================

describe('Vim Text Objects', () => {
  it('iw selects inner word', () => {
    const range = resolveTextObject('hello world', 0, 'w', 'inner')
    expect(range).not.toBeNull()
    expect(range!.start).toBe(0)
    expect(range!.end).toBe(5)
  })

  it('aw selects around word (with trailing space)', () => {
    const range = resolveTextObject('hello world', 0, 'w', 'around')
    expect(range).not.toBeNull()
    expect(range!.end).toBeGreaterThan(5)
  })

  it('i" selects inner quotes', () => {
    const range = resolveTextObject('say "hello" end', 5, '"', 'inner')
    expect(range).not.toBeNull()
    expect(range!.start).toBe(5)
    expect(range!.end).toBe(10)
  })

  it('i( selects inner parens', () => {
    const range = resolveTextObject('fn(arg)', 3, '(', 'inner')
    expect(range).not.toBeNull()
    expect(range!.start).toBe(3)
    expect(range!.end).toBe(6)
  })

  it('returns null for no match', () => {
    expect(resolveTextObject('hello', 0, '(', 'inner')).toBeNull()
  })
})

// ============================================================================
// Vim Transitions
// ============================================================================

describe('Vim Transitions', () => {
  it('idle + digit starts count', () => {
    const result = transition({ type: 'idle' }, '3', {} as any)
    expect(result.next?.type).toBe('count')
  })

  it('idle + operator starts operator', () => {
    const result = transition({ type: 'idle' }, 'd', {} as any)
    expect(result.next?.type).toBe('operator')
  })

  it('idle + f starts find', () => {
    const result = transition({ type: 'idle' }, 'f', {} as any)
    expect(result.next?.type).toBe('find')
  })

  it('idle + g starts g prefix', () => {
    const result = transition({ type: 'idle' }, 'g', {} as any)
    expect(result.next?.type).toBe('g')
  })

  it('idle + r starts replace', () => {
    const result = transition({ type: 'idle' }, 'r', {} as any)
    expect(result.next?.type).toBe('replace')
  })

  it('idle + > starts indent', () => {
    const result = transition({ type: 'idle' }, '>', {} as any)
    expect(result.next?.type).toBe('indent')
  })

  it('operator + same key = line op (dd)', () => {
    const result = transition({ type: 'operator', op: 'delete', count: 1 }, 'd', {} as any)
    expect(result.execute).toBeDefined()
  })

  it('operator + text obj scope transitions', () => {
    const result = transition({ type: 'operator', op: 'delete', count: 1 }, 'i', {} as any)
    expect(result.next?.type).toBe('operatorTextObj')
  })
})

// ============================================================================
// Memory Paths
// ============================================================================

describe('Memory Paths', () => {
  it('isAutoMemoryEnabled defaults to true', () => {
    delete process.env.KITE_DISABLE_AUTO_MEMORY
    delete process.env.KITE_SIMPLE
    expect(isAutoMemoryEnabled()).toBe(true)
  })

  it('getMemoryBaseDir returns ~/.kite/', () => {
    delete process.env.KITE_MEMORY_DIR
    const base = getMemoryBaseDir()
    expect(base).toContain('.kite')
  })

  it('sanitizePath sanitizes paths', () => {
    const result = sanitizePath('/home/user/project')
    expect(result).not.toContain('/')
    expect(result.length).toBeLessThanOrEqual(200)
  })

  it('getAutoMemEntrypoint returns MEMORY.md path', () => {
    const path = getAutoMemEntrypoint()
    expect(path).toContain('MEMORY.md')
  })

  it('getAutoMemDailyLogPath returns dated path', () => {
    const path = getAutoMemDailyLogPath(new Date(2024, 0, 15))
    expect(path).toContain('2024')
    expect(path).toContain('01')
    expect(path).toContain('15')
  })
})

// ============================================================================
// Memory System
// ============================================================================

describe('Memory System', () => {
  it('truncateEntrypointContent passes short content', () => {
    const result = truncateEntrypointContent('Hello world')
    expect(result.wasLineTruncated).toBe(false)
    expect(result.wasByteTruncated).toBe(false)
    expect(result.content).toBe('Hello world')
  })

  it('truncateEntrypointContent truncates long content', () => {
    const longContent = Array.from({ length: 300 }, (_, i) => `Line ${i}`).join('\n')
    const result = truncateEntrypointContent(longContent)
    expect(result.wasLineTruncated).toBe(true)
    expect(result.lineCount).toBeGreaterThan(MAX_ENTRYPOINT_LINES)
  })

  it('ENTRYPOINT_NAME is MEMORY.md', () => {
    expect(ENTRYPOINT_NAME).toBe('MEMORY.md')
  })

  it('MAX_ENTRYPOINT_LINES is 200', () => {
    expect(MAX_ENTRYPOINT_LINES).toBe(200)
  })

  it('buildMemoryPrompt returns string', () => {
    const prompt = buildMemoryPrompt()
    expect(typeof prompt).toBe('string')
  })

  it('getMemoryFiles returns array', () => {
    const files = getMemoryFiles(process.cwd())
    expect(Array.isArray(files)).toBe(true)
  })
})

// ============================================================================
// Skills
// ============================================================================

describe('Skills', () => {
  it('parseFrontmatter extracts frontmatter', () => {
    const content = '---\nname: test\ndescription: A test skill\n---\n\nBody text here.'
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('test')
    expect(result.frontmatter.description).toBe('A test skill')
    expect(result.body).toContain('Body text here.')
  })

  it('parseFrontmatter handles no frontmatter', () => {
    const result = parseFrontmatter('Just a body')
    expect(Object.keys(result.frontmatter)).toHaveLength(0)
    expect(result.body).toBe('Just a body')
  })

  it('getSkillsPath returns paths', () => {
    const projectPath = getSkillsPath('project')
    expect(projectPath).toContain('.kite')
    expect(projectPath).toContain('skills')

    const userPath = getSkillsPath('user')
    expect(userPath).toContain('skills')
  })

  it('getSkillDirCommands returns array', () => {
    clearSkillCaches()
    const commands = getSkillDirCommands(process.cwd())
    expect(Array.isArray(commands)).toBe(true)
  })

  it('getDynamicSkills returns empty initially', () => {
    const skills = getDynamicSkills()
    expect(Array.isArray(skills)).toBe(true)
  })

  it('registerDynamicSkill adds a skill', () => {
    const before = getDynamicSkills().length
    registerDynamicSkill({
      type: 'prompt',
      name: 'test-dynamic-skill',
      description: 'Test',
      progressMessage: 'testing',
      contentLength: 10,
      source: 'builtin',
      async getPromptForCommand() { return [{ type: 'text', text: 'test' }] },
    })
    expect(getDynamicSkills().length).toBe(before + 1)
  })
})
