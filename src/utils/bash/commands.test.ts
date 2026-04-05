import { describe, it, expect } from 'vitest'
import { splitCommand, splitCommandWithOperators, filterControlOperators, isHelpCommand, stripOutputRedirections } from './commands.js'

describe('splitCommand', () => {
  it('splits on &&', () => {
    const result = splitCommand('echo a && echo b')
    expect(result.length).toBe(2)
    expect(result[0]!.trim()).toBe('echo a')
    expect(result[1]!.trim()).toBe('echo b')
  })

  it('splits on ||', () => {
    const result = splitCommand('echo a || echo b')
    expect(result.length).toBe(2)
    expect(result[0]!.trim()).toBe('echo a')
    expect(result[1]!.trim()).toBe('echo b')
  })

  it('splits on ;', () => {
    const result = splitCommand('echo a; echo b')
    expect(result.length).toBe(2)
    expect(result[0]!.trim()).toBe('echo a')
    expect(result[1]!.trim()).toBe('echo b')
  })

  it('splits on |', () => {
    const result = splitCommand('echo a | grep b')
    expect(result.length).toBe(2)
    expect(result[0]!.trim()).toBe('echo a')
    expect(result[1]!.trim()).toBe('grep b')
  })

  it('does not split inside single quotes', () => {
    const result = splitCommand("echo 'a && b'")
    expect(result.length).toBe(1)
    expect(result[0]).toContain('a && b')
  })

  it('does not split inside double quotes', () => {
    const result = splitCommand('echo "a && b"')
    expect(result.length).toBe(1)
    expect(result[0]).toContain('a && b')
  })

  it('handles single command', () => {
    const result = splitCommand('echo hello')
    expect(result.length).toBe(1)
    expect(result[0]!.trim()).toBe('echo hello')
  })

  it('handles empty string', () => {
    const result = splitCommand('')
    // May return [''] or [] — either is fine
    expect(result.length).toBeLessThanOrEqual(1)
  })
})

describe('splitCommandWithOperators', () => {
  it('preserves operators', () => {
    const result = splitCommandWithOperators('echo a && echo b')
    expect(result).toContain('&&')
  })

  it('interleaves commands and operators', () => {
    const result = splitCommandWithOperators('a; b; c')
    expect(result.filter(s => s === ';').length).toBe(2)
  })
})

describe('filterControlOperators', () => {
  it('removes operators', () => {
    expect(filterControlOperators(['echo a', '&&', 'echo b'])).toEqual(['echo a', 'echo b'])
  })

  it('removes all operator types', () => {
    expect(filterControlOperators(['a', '||', 'b', '|', 'c', ';', 'd', '&', 'e'])).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns empty for all operators', () => {
    expect(filterControlOperators(['&&', '||'])).toEqual([])
  })
})

describe('isHelpCommand', () => {
  it('detects --help', () => {
    expect(isHelpCommand('git --help')).toBe(true)
  })

  it('rejects commands with other flags', () => {
    expect(isHelpCommand('git -v --help')).toBe(false)
  })

  it('rejects commands with quotes', () => {
    expect(isHelpCommand('echo "test" --help')).toBe(false)
  })

  it('rejects commands without --help', () => {
    expect(isHelpCommand('git status')).toBe(false)
  })
})

describe('stripOutputRedirections', () => {
  it('strips 2>&1', () => {
    expect(stripOutputRedirections('cmd 2>&1')).toBe('cmd')
  })

  it('strips file redirections', () => {
    const result = stripOutputRedirections('cmd > file.txt')
    expect(result).not.toContain('file.txt')
  })
})
