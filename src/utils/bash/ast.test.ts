import { describe, it, expect } from 'vitest'
import {
  extractQuotedContent,
  stripSafeRedirections,
  isEscapedAtPosition,
  hasUnescapedChar,
  containsAnyPlaceholder,
  CMDSUB_PLACEHOLDER,
  VAR_PLACEHOLDER,
  CONTROL_CHAR_RE,
  UNICODE_WHITESPACE_RE,
  EVAL_LIKE_BUILTINS,
  ZSH_DANGEROUS_BUILTINS,
  SAFE_ENV_VARS,
  tooComplex,
} from './ast.js'

describe('extractQuotedContent', () => {
  it('strips single-quoted content', () => {
    const result = extractQuotedContent("echo 'hello world'")
    expect(result.withDoubleQuotes).toBe('echo ')
    expect(result.fullyUnquoted).toBe('echo ')
  })

  it('strips double-quoted content but keeps in withDoubleQuotes', () => {
    const result = extractQuotedContent('echo "hello world"')
    expect(result.withDoubleQuotes).toBe('echo hello world')
    expect(result.fullyUnquoted).toBe('echo ')
  })

  it('handles backslash escaping outside quotes', () => {
    const result = extractQuotedContent('echo \\$HOME')
    expect(result.fullyUnquoted).toBe('echo \\$HOME')
  })

  it('backslash is literal inside single quotes', () => {
    const result = extractQuotedContent("echo '\\n'")
    expect(result.withDoubleQuotes).toBe('echo ')
    expect(result.fullyUnquoted).toBe('echo ')
  })

  it('handles backslash escaping inside double quotes', () => {
    const result = extractQuotedContent('echo "hello \\"world\\""')
    expect(result.withDoubleQuotes).toContain('hello')
  })

  it('preserves quote chars in unquotedKeepQuoteChars', () => {
    const result = extractQuotedContent("echo 'test'")
    expect(result.unquotedKeepQuoteChars).toContain("'")
  })

  it('handles jq mode', () => {
    const result = extractQuotedContent('jq ".name"', true)
    // In jq mode, double quote chars are included
    expect(result.withDoubleQuotes).toContain('"')
  })

  it('handles empty string', () => {
    const result = extractQuotedContent('')
    expect(result.fullyUnquoted).toBe('')
    expect(result.withDoubleQuotes).toBe('')
  })

  it('handles nested quotes', () => {
    const result = extractQuotedContent(`echo "it's a test"`)
    expect(result.withDoubleQuotes).toContain("it's a test")
  })
})

describe('stripSafeRedirections', () => {
  it('strips 2>&1', () => {
    expect(stripSafeRedirections('cmd 2>&1')).toBe('cmd')
  })

  it('strips > /dev/null', () => {
    expect(stripSafeRedirections('cmd > /dev/null')).toBe('cmd')
  })

  it('strips 2> /dev/null', () => {
    expect(stripSafeRedirections('cmd 2> /dev/null').trim()).toBe('cmd')
  })

  it('strips < /dev/null', () => {
    expect(stripSafeRedirections('cmd < /dev/null')).toBe('cmd')
  })

  it('does NOT strip /dev/nullo (boundary check)', () => {
    const result = stripSafeRedirections('cmd > /dev/nullo')
    expect(result).toContain('/dev/nullo')
  })

  it('handles multiple redirections', () => {
    expect(stripSafeRedirections('cmd 2>&1 > /dev/null')).toBe('cmd')
  })
})

describe('isEscapedAtPosition', () => {
  it('detects escaped character', () => {
    expect(isEscapedAtPosition('\\n', 1)).toBe(true)
  })

  it('detects non-escaped character', () => {
    expect(isEscapedAtPosition('n', 0)).toBe(false)
  })

  it('handles double backslash', () => {
    expect(isEscapedAtPosition('\\\\n', 2)).toBe(false) // \\n -> n is not escaped
  })

  it('handles triple backslash', () => {
    expect(isEscapedAtPosition('\\\\\\n', 3)).toBe(true)
  })
})

describe('hasUnescapedChar', () => {
  it('finds unescaped char', () => {
    expect(hasUnescapedChar('hello`world', '`')).toBe(true)
  })

  it('ignores escaped char', () => {
    expect(hasUnescapedChar('hello\\`world', '`')).toBe(false)
  })

  it('finds char when double-escaped', () => {
    expect(hasUnescapedChar('hello\\\\`world', '`')).toBe(true)
  })
})

describe('containsAnyPlaceholder', () => {
  it('detects CMDSUB_PLACEHOLDER', () => {
    expect(containsAnyPlaceholder(`foo ${CMDSUB_PLACEHOLDER} bar`)).toBe(true)
  })

  it('detects VAR_PLACEHOLDER', () => {
    expect(containsAnyPlaceholder(`foo ${VAR_PLACEHOLDER} bar`)).toBe(true)
  })

  it('returns false for normal text', () => {
    expect(containsAnyPlaceholder('echo hello')).toBe(false)
  })
})

describe('Pre-check regexes', () => {
  it('CONTROL_CHAR_RE detects null bytes', () => {
    expect(CONTROL_CHAR_RE.test('echo\x00hello')).toBe(true)
  })

  it('CONTROL_CHAR_RE allows normal text', () => {
    expect(CONTROL_CHAR_RE.test('echo hello')).toBe(false)
  })

  it('CONTROL_CHAR_RE allows tabs and newlines', () => {
    expect(CONTROL_CHAR_RE.test('echo\thello\n')).toBe(false)
  })

  it('UNICODE_WHITESPACE_RE detects NBSP', () => {
    expect(UNICODE_WHITESPACE_RE.test('echo\u00A0hello')).toBe(true)
  })

  it('UNICODE_WHITESPACE_RE allows regular spaces', () => {
    expect(UNICODE_WHITESPACE_RE.test('echo hello')).toBe(false)
  })
})

describe('Constant sets', () => {
  it('EVAL_LIKE_BUILTINS contains eval', () => {
    expect(EVAL_LIKE_BUILTINS.has('eval')).toBe(true)
    expect(EVAL_LIKE_BUILTINS.has('source')).toBe(true)
    expect(EVAL_LIKE_BUILTINS.has('exec')).toBe(true)
    expect(EVAL_LIKE_BUILTINS.has('echo')).toBe(false)
  })

  it('ZSH_DANGEROUS_BUILTINS contains zsh-specific commands', () => {
    expect(ZSH_DANGEROUS_BUILTINS.has('zmodload')).toBe(true)
    expect(ZSH_DANGEROUS_BUILTINS.has('ztcp')).toBe(true)
    expect(ZSH_DANGEROUS_BUILTINS.has('ls')).toBe(false)
  })

  it('SAFE_ENV_VARS contains common vars', () => {
    expect(SAFE_ENV_VARS.has('HOME')).toBe(true)
    expect(SAFE_ENV_VARS.has('PATH')).toBe(true)
    expect(SAFE_ENV_VARS.has('MALICIOUS_VAR')).toBe(false)
  })
})

describe('tooComplex', () => {
  it('returns too-complex result', () => {
    const result = tooComplex('unknown construct', 'heredoc')
    expect(result.kind).toBe('too-complex')
    expect(result.reason).toBe('unknown construct')
    expect(result.nodeType).toBe('heredoc')
  })
})
