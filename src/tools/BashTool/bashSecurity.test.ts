import { describe, it, expect } from 'vitest'
import {
  bashCommandIsSafe,
  validateEmpty,
  validateIncompleteCommands,
  validateGitCommit,
  validateJqCommand,
  validateObfuscatedFlags,
  validateShellMetacharacters,
  validateDangerousVariables,
  validateDangerousPatterns,
  validateRedirections,
  validateNewlines,
  validateCarriageReturn,
  validateIFSInjection,
  validateProcEnvironAccess,
  validateBackslashEscapedWhitespace,
  validateBackslashEscapedOperators,
  validateUnicodeWhitespace,
  validateMidWordHash,
  validateBraceExpansion,
  validateZshDangerousCommands,
  validateCommentQuoteDesync,
  validateQuotedNewline,
  validateMalformedTokenInjection,
  type ValidationContext,
} from './bashSecurity.js'
import { extractQuotedContent, stripSafeRedirections } from '../../utils/bash/ast.js'

function makeCtx(command: string): ValidationContext {
  const baseCommand = (command.trim().split(/\s+/)[0] || '').replace(/^.*\//, '')
  const q = extractQuotedContent(command, baseCommand === 'jq')
  return {
    originalCommand: command,
    baseCommand,
    unquotedContent: q.withDoubleQuotes,
    fullyUnquotedContent: stripSafeRedirections(q.fullyUnquoted),
    fullyUnquotedPreStrip: q.fullyUnquoted,
    unquotedKeepQuoteChars: q.unquotedKeepQuoteChars,
  }
}

describe('validateEmpty', () => {
  it('allows empty commands', () => {
    expect(validateEmpty(makeCtx('')).behavior).toBe('allow')
    expect(validateEmpty(makeCtx('   ')).behavior).toBe('allow')
  })
  it('passes through non-empty', () => {
    expect(validateEmpty(makeCtx('echo hi')).behavior).toBe('passthrough')
  })
})

describe('validateIncompleteCommands', () => {
  it('flags commands starting with tab', () => {
    expect(validateIncompleteCommands(makeCtx('\techo hi')).behavior).toBe('ask')
  })
  it('flags commands starting with dash', () => {
    expect(validateIncompleteCommands(makeCtx('-n hello')).behavior).toBe('ask')
  })
  it('flags commands starting with operator', () => {
    expect(validateIncompleteCommands(makeCtx('&& echo hi')).behavior).toBe('ask')
    expect(validateIncompleteCommands(makeCtx('|| echo hi')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateIncompleteCommands(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateGitCommit', () => {
  it('allows simple git commit -m', () => {
    const result = validateGitCommit(makeCtx('git commit -m "fix bug"'))
    expect(result.behavior).toBe('allow')
  })
  it('allows single-quoted message', () => {
    expect(validateGitCommit(makeCtx("git commit -m 'fix bug'")).behavior).toBe('allow')
  })
  it('flags command substitution in message', () => {
    expect(validateGitCommit(makeCtx('git commit -m "$(date)"')).behavior).toBe('ask')
  })
  it('passes through non-git commands', () => {
    expect(validateGitCommit(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
  it('flags message starting with dash', () => {
    expect(validateGitCommit(makeCtx('git commit -m "-flag"')).behavior).toBe('ask')
  })
})

describe('validateJqCommand', () => {
  it('flags jq system()', () => {
    expect(validateJqCommand(makeCtx('jq "system(\"id\")"')).behavior).toBe('ask')
  })
  it('flags jq -f', () => {
    expect(validateJqCommand(makeCtx('jq -f script.jq data.json')).behavior).toBe('ask')
  })
  it('flags jq --from-file', () => {
    expect(validateJqCommand(makeCtx('jq --from-file script.jq')).behavior).toBe('ask')
  })
  it('passes safe jq', () => {
    expect(validateJqCommand(makeCtx('jq .name data.json')).behavior).toBe('passthrough')
  })
  it('passes non-jq commands', () => {
    expect(validateJqCommand(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateObfuscatedFlags', () => {
  it('flags ANSI-C quoting', () => {
    expect(validateObfuscatedFlags(makeCtx("echo $'hello'")).behavior).toBe('ask')
  })
  it('flags locale quoting', () => {
    expect(validateObfuscatedFlags(makeCtx('echo $"hello"')).behavior).toBe('ask')
  })
  it('flags empty quotes before dash', () => {
    expect(validateObfuscatedFlags(makeCtx("$'' -exec")).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateObfuscatedFlags(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateDangerousVariables', () => {
  it('flags variable before pipe', () => {
    expect(validateDangerousVariables(makeCtx('$HOME | cat')).behavior).toBe('ask')
  })
  it('flags variable after redirect', () => {
    expect(validateDangerousVariables(makeCtx('echo > $file')).behavior).toBe('ask')
  })
  it('passes safe commands', () => {
    expect(validateDangerousVariables(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateDangerousPatterns', () => {
  it('flags backticks', () => {
    expect(validateDangerousPatterns(makeCtx('echo `whoami`')).behavior).toBe('ask')
  })
  it('flags $() substitution', () => {
    expect(validateDangerousPatterns(makeCtx('echo $(id)')).behavior).toBe('ask')
  })
  it('flags ${} expansion', () => {
    expect(validateDangerousPatterns(makeCtx('echo ${HOME}')).behavior).toBe('ask')
  })
  it('flags process substitution', () => {
    expect(validateDangerousPatterns(makeCtx('diff <(cmd1) file')).behavior).toBe('ask')
  })
  it('passes safe commands', () => {
    expect(validateDangerousPatterns(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateRedirections', () => {
  it('flags input redirection', () => {
    expect(validateRedirections(makeCtx('cat < /etc/passwd')).behavior).toBe('ask')
  })
  it('flags output redirection', () => {
    expect(validateRedirections(makeCtx('echo hi > file.txt')).behavior).toBe('ask')
  })
  it('passes commands without redirections (after stripping safe ones)', () => {
    expect(validateRedirections(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateNewlines', () => {
  it('flags newlines followed by non-whitespace', () => {
    expect(validateNewlines(makeCtx('echo hi\nrm -rf /')).behavior).toBe('ask')
  })
  it('passes commands without newlines', () => {
    expect(validateNewlines(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateCarriageReturn', () => {
  it('flags CR outside double quotes', () => {
    expect(validateCarriageReturn(makeCtx('echo\rhello')).behavior).toBe('ask')
  })
  it('passes commands without CR', () => {
    expect(validateCarriageReturn(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateIFSInjection', () => {
  it('flags $IFS', () => {
    expect(validateIFSInjection(makeCtx('echo$IFS/etc/passwd')).behavior).toBe('ask')
  })
  it('flags ${IFS}', () => {
    expect(validateIFSInjection(makeCtx('echo${IFS}hello')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateIFSInjection(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateProcEnvironAccess', () => {
  it('flags /proc/self/environ', () => {
    expect(validateProcEnvironAccess(makeCtx('cat /proc/self/environ')).behavior).toBe('ask')
  })
  it('flags /proc/1/environ', () => {
    expect(validateProcEnvironAccess(makeCtx('cat /proc/1/environ')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateProcEnvironAccess(makeCtx('cat /proc/cpuinfo')).behavior).toBe('passthrough')
  })
})

describe('validateBackslashEscapedWhitespace', () => {
  it('flags backslash-space', () => {
    expect(validateBackslashEscapedWhitespace(makeCtx('echo\\ hello')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateBackslashEscapedWhitespace(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateBackslashEscapedOperators', () => {
  it('flags \\;', () => {
    expect(validateBackslashEscapedOperators(makeCtx('find . -name "*.txt" \\; echo')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateBackslashEscapedOperators(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateUnicodeWhitespace', () => {
  it('flags NBSP', () => {
    expect(validateUnicodeWhitespace(makeCtx('echo\u00A0hello')).behavior).toBe('ask')
  })
  it('flags zero-width space', () => {
    expect(validateUnicodeWhitespace(makeCtx('echo\u200Bhello')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateUnicodeWhitespace(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateBraceExpansion', () => {
  it('flags comma in braces', () => {
    expect(validateBraceExpansion(makeCtx('echo {a,b}')).behavior).toBe('ask')
  })
  it('flags range in braces', () => {
    expect(validateBraceExpansion(makeCtx('echo {1..5}')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateBraceExpansion(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateZshDangerousCommands', () => {
  it('flags zmodload', () => {
    expect(validateZshDangerousCommands(makeCtx('zmodload zsh/system')).behavior).toBe('ask')
  })
  it('flags emulate', () => {
    expect(validateZshDangerousCommands(makeCtx('emulate -LR zsh')).behavior).toBe('ask')
  })
  it('flags ztcp', () => {
    expect(validateZshDangerousCommands(makeCtx('ztcp host 80')).behavior).toBe('ask')
  })
  it('flags fc -e', () => {
    expect(validateZshDangerousCommands(makeCtx('fc -e vim')).behavior).toBe('ask')
  })
  it('passes normal commands', () => {
    expect(validateZshDangerousCommands(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
  it('skips env var prefixes', () => {
    expect(validateZshDangerousCommands(makeCtx('FOO=bar zmodload zsh/system')).behavior).toBe('ask')
  })
})

describe('validateCommentQuoteDesync', () => {
  it('flags quotes in comments', () => {
    const cmd = "echo hello # it's a test"
    expect(validateCommentQuoteDesync(makeCtx(cmd)).behavior).toBe('ask')
  })
  it('passes commands without comments', () => {
    expect(validateCommentQuoteDesync(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('validateQuotedNewline', () => {
  it('flags quoted newline followed by #', () => {
    const cmd = 'echo "hello\n# hidden'
    expect(validateQuotedNewline(makeCtx(cmd)).behavior).toBe('ask')
  })
  it('passes commands without pattern', () => {
    expect(validateQuotedNewline(makeCtx('echo hello')).behavior).toBe('passthrough')
  })
})

describe('bashCommandIsSafe (full chain)', () => {
  it('allows empty command', () => {
    expect(bashCommandIsSafe('').behavior).toBe('allow')
  })

  it('passes simple safe commands', () => {
    expect(bashCommandIsSafe('echo hello').behavior).toBe('passthrough')
    expect(bashCommandIsSafe('ls -la').behavior).toBe('passthrough')
  })

  it('flags control characters', () => {
    expect(bashCommandIsSafe('echo\x00hello').behavior).toBe('ask')
  })

  it('flags command substitution', () => {
    expect(bashCommandIsSafe('echo $(whoami)').behavior).toBe('ask')
  })

  it('flags backticks', () => {
    expect(bashCommandIsSafe('echo `id`').behavior).toBe('ask')
  })

  it('flags process substitution', () => {
    expect(bashCommandIsSafe('diff <(ls) file').behavior).toBe('ask')
  })

  it('flags redirections', () => {
    expect(bashCommandIsSafe('echo hi > /tmp/file').behavior).toBe('ask')
  })

  it('allows git commit with simple message', () => {
    expect(bashCommandIsSafe('git commit -m "fix bug"').behavior).toBe('allow')
  })

  it('flags /proc/environ', () => {
    expect(bashCommandIsSafe('cat /proc/self/environ').behavior).toBe('ask')
  })

  it('flags brace expansion', () => {
    expect(bashCommandIsSafe('echo {a,b,c}').behavior).toBe('ask')
  })

  it('flags IFS injection', () => {
    expect(bashCommandIsSafe('echo$IFS/etc/passwd').behavior).toBe('ask')
  })
})
