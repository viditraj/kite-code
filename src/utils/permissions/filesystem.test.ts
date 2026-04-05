import { describe, it, expect } from 'vitest'
import {
  normalizeCaseForComparison,
  isDangerousFilePathToAutoEdit,
  hasSuspiciousWindowsPathPattern,
  pathInWorkingPath,
  pathInAllowedWorkingPaths,
  checkPathSafetyForAutoEdit,
  isKiteSettingsPath,
  isKiteConfigFilePath,
  getKiteTempDirName,
  DANGEROUS_FILES,
  DANGEROUS_DIRECTORIES,
} from './filesystem.js'

const isWindows = process.platform === 'win32'
const describeUnix = isWindows ? describe.skip : describe

describe('normalizeCaseForComparison', () => {
  it('lowercases paths', () => {
    expect(normalizeCaseForComparison('/Foo/BAR/baz')).toBe('/foo/bar/baz')
  })
})

describe('isDangerousFilePathToAutoEdit', () => {
  it('detects dangerous directories', () => {
    expect(isDangerousFilePathToAutoEdit('/project/.git/config')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/project/.vscode/settings.json')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/project/.idea/misc.xml')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/project/.kite/settings.json')).toBe(true)
  })

  it('case-insensitive directory check', () => {
    expect(isDangerousFilePathToAutoEdit('/project/.GIT/config')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/project/.Git/config')).toBe(true)
  })

  it('allows .kite/worktrees/ as structural', () => {
    expect(isDangerousFilePathToAutoEdit('/project/.kite/worktrees/main/file.txt')).toBe(false)
  })

  it('detects dangerous files', () => {
    expect(isDangerousFilePathToAutoEdit('/home/user/.bashrc')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/home/user/.gitconfig')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/home/user/.zshrc')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('/project/.mcp.json')).toBe(true)
  })

  it('case-insensitive file check', () => {
    expect(isDangerousFilePathToAutoEdit('/home/user/.BASHRC')).toBe(true)
  })

  it('UNC paths are dangerous', () => {
    expect(isDangerousFilePathToAutoEdit('\\\\server\\share')).toBe(true)
    expect(isDangerousFilePathToAutoEdit('//server/share')).toBe(true)
  })

  it('normal files are safe', () => {
    expect(isDangerousFilePathToAutoEdit('/project/src/main.ts')).toBe(false)
    expect(isDangerousFilePathToAutoEdit('/project/README.md')).toBe(false)
  })
})

describe('hasSuspiciousWindowsPathPattern', () => {
  it('detects 8.3 short names', () => {
    expect(hasSuspiciousWindowsPathPattern('C:\\GIT~1\\config')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('CLAUDE~1')).toBe(true)
  })

  it('detects long path prefixes', () => {
    expect(hasSuspiciousWindowsPathPattern('\\\\?\\C:\\Users')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('\\\\.\\C:\\')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('//?/C:/')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('//./C:/')).toBe(true)
  })

  it('detects trailing dots/spaces', () => {
    expect(hasSuspiciousWindowsPathPattern('.git.')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('.bashrc  ')).toBe(true)
  })

  it('detects DOS device names', () => {
    expect(hasSuspiciousWindowsPathPattern('.git.CON')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('settings.json.PRN')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('.bashrc.AUX')).toBe(true)
  })

  it('detects triple dots as path component', () => {
    expect(hasSuspiciousWindowsPathPattern('/.../file.txt')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('path/.../file')).toBe(true)
  })

  it('detects UNC paths', () => {
    expect(hasSuspiciousWindowsPathPattern('\\\\server\\share')).toBe(true)
    expect(hasSuspiciousWindowsPathPattern('//server/share')).toBe(true)
  })

  it('allows normal paths', () => {
    expect(hasSuspiciousWindowsPathPattern('/home/user/project/src/main.ts')).toBe(false)
    expect(hasSuspiciousWindowsPathPattern('/tmp/file.txt')).toBe(false)
  })
})

describeUnix('pathInWorkingPath', () => {
  it('same path returns true', () => {
    expect(pathInWorkingPath('/project', '/project')).toBe(true)
  })

  it('child path returns true', () => {
    expect(pathInWorkingPath('/project/src/main.ts', '/project')).toBe(true)
  })

  it('outside path returns false', () => {
    expect(pathInWorkingPath('/etc/passwd', '/project')).toBe(false)
  })

  it('rejects traversal', () => {
    expect(pathInWorkingPath('/project/../etc/passwd', '/project')).toBe(false)
  })

  it('normalizes macOS /private/tmp', () => {
    expect(pathInWorkingPath('/private/tmp/file', '/tmp')).toBe(true)
    expect(pathInWorkingPath('/tmp/file', '/private/tmp')).toBe(true)
  })

  it('normalizes macOS /private/var', () => {
    expect(pathInWorkingPath('/private/var/data', '/var/data')).toBe(true)
  })

  it('case-insensitive', () => {
    expect(pathInWorkingPath('/Project/SRC/main.ts', '/project')).toBe(true)
  })
})

describeUnix('pathInAllowedWorkingPaths', () => {
  it('true if in any working dir', () => {
    expect(pathInAllowedWorkingPaths('/a/file', ['/b', '/a'])).toBe(true)
  })

  it('false if in none', () => {
    expect(pathInAllowedWorkingPaths('/c/file', ['/a', '/b'])).toBe(false)
  })
})

describeUnix('checkPathSafetyForAutoEdit', () => {
  it('safe for normal paths', () => {
    const result = checkPathSafetyForAutoEdit('/project/src/main.ts')
    expect(result.safe).toBe(true)
  })

  it('unsafe for dangerous files', () => {
    const result = checkPathSafetyForAutoEdit('/home/user/.bashrc')
    expect(result.safe).toBe(false)
    if (!result.safe) expect(result.classifierApprovable).toBe(true)
  })

  it('unsafe for suspicious windows patterns', () => {
    const result = checkPathSafetyForAutoEdit('\\\\?\\C:\\Users\\file')
    expect(result.safe).toBe(false)
    if (!result.safe) expect(result.classifierApprovable).toBe(false)
  })

  it('checks all provided paths', () => {
    // Original path is safe, but symlink-resolved path is dangerous
    const result = checkPathSafetyForAutoEdit(
      '/project/safe-link',
      ['/project/safe-link', '/home/user/.bashrc'],
    )
    expect(result.safe).toBe(false)
  })
})

describe('isKiteSettingsPath', () => {
  it('detects .kite/settings.json', () => {
    expect(isKiteSettingsPath('/project/.kite/settings.json')).toBe(true)
    expect(isKiteSettingsPath('/project/.kite/settings.local.json')).toBe(true)
  })

  it('rejects non-settings', () => {
    expect(isKiteSettingsPath('/project/.kite/config.json')).toBe(false)
    expect(isKiteSettingsPath('/project/settings.json')).toBe(false)
  })
})

describe('isKiteConfigFilePath', () => {
  it('detects settings', () => {
    expect(isKiteConfigFilePath('/project/.kite/settings.json')).toBe(true)
  })

  it('detects commands directory', () => {
    expect(isKiteConfigFilePath('/project/.kite/commands/build.md')).toBe(true)
  })

  it('detects agents directory', () => {
    expect(isKiteConfigFilePath('/project/.kite/agents/helper.md')).toBe(true)
  })

  it('detects skills directory', () => {
    expect(isKiteConfigFilePath('/project/.kite/skills/deploy/SKILL.md')).toBe(true)
  })

  it('allows non-config paths', () => {
    expect(isKiteConfigFilePath('/project/src/main.ts')).toBe(false)
  })
})

describeUnix('getKiteTempDirName', () => {
  it('includes uid on Unix', () => {
    const name = getKiteTempDirName()
    expect(name).toMatch(/^kite-\d+$/)
  })
})
