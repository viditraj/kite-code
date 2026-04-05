import { describe, it, expect } from 'vitest'
import {
  bashToolCheckPermission,
  bashToolHasPermission,
  stripSafeEnvVars,
  stripAllLeadingEnvVars,
  stripSafeWrappers,
  stripOutputRedirections,
  getSimpleCommandPrefix,
} from './bashPermissions.js'
import { createEmptyToolPermissionContext } from '../../types/permissions.js'

describe('stripSafeEnvVars', () => {
  it('strips safe vars', () => {
    expect(stripSafeEnvVars('NODE_ENV=prod npm run build')).toBe('npm run build')
  })

  it('strips multiple safe vars', () => {
    expect(stripSafeEnvVars('LANG=en_US TERM=xterm echo hello')).toBe('echo hello')
  })

  it('does not strip unknown vars', () => {
    expect(stripSafeEnvVars('MALICIOUS=x cmd')).toBe('MALICIOUS=x cmd')
  })

  it('handles no vars', () => {
    expect(stripSafeEnvVars('echo hello')).toBe('echo hello')
  })
})

describe('stripAllLeadingEnvVars', () => {
  it('strips all vars', () => {
    expect(stripAllLeadingEnvVars('FOO=bar BAZ=qux echo hello')).toBe('echo hello')
  })

  it('strips quoted values', () => {
    expect(stripAllLeadingEnvVars("FOO='bar baz' echo hello")).toBe('echo hello')
  })

  it('handles no vars', () => {
    expect(stripAllLeadingEnvVars('echo hello')).toBe('echo hello')
  })
})

describe('stripSafeWrappers', () => {
  it('strips timeout', () => {
    const result = stripSafeWrappers('timeout 5 echo hello')
    expect(result).toContain('echo hello')
  })

  it('strips time', () => {
    expect(stripSafeWrappers('time echo hello')).toBe('echo hello')
  })

  it('strips nohup', () => {
    expect(stripSafeWrappers('nohup echo hello')).toBe('echo hello')
  })

  it('strips env vars + wrappers', () => {
    const result = stripSafeWrappers('NODE_ENV=prod time echo hello')
    expect(result).toBe('echo hello')
  })

  it('handles no wrappers', () => {
    expect(stripSafeWrappers('echo hello')).toBe('echo hello')
  })
})

describe('stripOutputRedirections', () => {
  it('strips 2>&1', () => {
    expect(stripOutputRedirections('cmd 2>&1')).toBe('cmd')
  })

  it('strips file redirections', () => {
    expect(stripOutputRedirections('echo hi > file.txt')).toBe('echo hi')
  })
})

describe('getSimpleCommandPrefix', () => {
  it('extracts 2-word prefix', () => {
    expect(getSimpleCommandPrefix('git commit -m "msg"')).toBe('git commit')
  })

  it('extracts single word for no subcommand', () => {
    expect(getSimpleCommandPrefix('npm install')).toBe('npm install')
  })

  it('skips safe env vars', () => {
    expect(getSimpleCommandPrefix('NODE_ENV=prod npm run build')).toBe('npm run')
  })

  it('rejects bare shell prefixes', () => {
    expect(getSimpleCommandPrefix('bash -c "echo hi"')).toBeNull()
    expect(getSimpleCommandPrefix('sudo rm -rf /')).toBeNull()
    expect(getSimpleCommandPrefix('env FOO=bar cmd')).toBeNull()
  })

  it('rejects when second token is a flag', () => {
    expect(getSimpleCommandPrefix('echo -n hello')).toBe('echo')
  })
})

describe('bashToolCheckPermission', () => {
  it('passes through simple commands with no rules', () => {
    const ctx = createEmptyToolPermissionContext()
    const result = bashToolCheckPermission('echo hello', ctx)
    // Should be 'passthrough' (no rules match, security checks pass)
    expect(result.behavior).toBe('passthrough')
  })

  it('denies commands matching deny rules', () => {
    const ctx = {
      ...createEmptyToolPermissionContext(),
      alwaysDenyRules: { userSettings: ['Bash(rm -rf /)'] },
    }
    const result = bashToolCheckPermission('rm -rf /', ctx)
    expect(result.behavior).toBe('deny')
  })

  it('allows commands matching allow rules', () => {
    const ctx = {
      ...createEmptyToolPermissionContext(),
      alwaysAllowRules: { userSettings: ['Bash(echo hello)'] },
    }
    const result = bashToolCheckPermission('echo hello', ctx)
    expect(result.behavior).toBe('allow')
  })

  it('flags dangerous commands via security checks', () => {
    const ctx = createEmptyToolPermissionContext()
    const result = bashToolCheckPermission('echo $(whoami)', ctx)
    expect(result.behavior).toBe('ask')
  })
})

describe('bashToolHasPermission', () => {
  it('checks compound commands individually', () => {
    const ctx = {
      ...createEmptyToolPermissionContext(),
      alwaysDenyRules: { userSettings: ['Bash(rm -rf /)'] },
    }
    const result = bashToolHasPermission('echo hello && rm -rf /', ctx)
    expect(result.behavior).toBe('deny')
  })

  it('allows when all subcommands pass', () => {
    const ctx = {
      ...createEmptyToolPermissionContext(),
      alwaysAllowRules: { userSettings: ['Bash(echo hello)', 'Bash(echo world)'] },
    }
    const result = bashToolHasPermission('echo hello && echo world', ctx)
    expect(result.behavior).toBe('allow')
  })
})
