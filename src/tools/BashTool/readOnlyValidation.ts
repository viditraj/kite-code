/**
 * Read-only command detection and flag validation.
 *
 * Determines whether a bash command is read-only (safe to auto-approve without
 * prompting the user). This includes:
 * - Flag-based validation for known commands (xargs, file, sort, grep, ps, git)
 * - Regex-based validation for simple read-only commands (cat, ls, find, etc.)
 * - Unquoted expansion detection (variable expansion, globs)
 * - Git subcommand read-only detection with per-subcommand flag allowlists
 *
 * The main entry point is checkReadOnlyConstraints(), which checks whether a
 * compound command (potentially with &&, ||, |, ;) consists entirely of
 * read-only subcommands.
 */

import type { PermissionResult } from '../../Tool.js'
import type { ToolPermissionContext } from '../../types/permissions.js'
import { splitCommand } from '../../utils/bash/commands.js'
import { bashCommandIsSafe } from './bashSecurity.js'

// ============================================================================
// Types
// ============================================================================

export type FlagArgType = 'none' | 'number' | 'string' | 'char' | '{}' | 'EOF'

export interface ExternalCommandConfig {
  safeFlags: Record<string, FlagArgType>
  additionalCommandIsDangerousCallback?: (rawCommand: string, args: string[]) => boolean
  respectsDoubleDash?: boolean // Default: true
}

// ============================================================================
// Constants
// ============================================================================

export const FLAG_PATTERN = /^-[a-zA-Z0-9_-]/

// ============================================================================
// Flag validation helpers
// ============================================================================

/**
 * Validate that a value conforms to the expected argument type for a flag.
 */
export function validateFlagArgument(value: string, argType: FlagArgType): boolean {
  switch (argType) {
    case 'none':
      return false
    case 'number':
      return /^\d+$/.test(value)
    case 'string':
      return true
    case 'char':
      return value.length === 1
    case '{}':
      return value === '{}'
    case 'EOF':
      return value === 'EOF'
    default:
      return false
  }
}

/**
 * Core flag validation function. Walk through tokens starting at startIndex,
 * verifying that every flag is in the safe flags allowlist and that arguments
 * to flags are valid.
 *
 * Returns true if all tokens are safe; false if any token is disallowed.
 */
export function validateFlags(
  tokens: string[],
  startIndex: number,
  config: ExternalCommandConfig,
  options?: { isGit?: boolean; isGrepOrRg?: boolean },
): boolean {
  const isGit = options?.isGit ?? false
  const isGrepOrRg = options?.isGrepOrRg ?? false

  let i = startIndex
  while (i < tokens.length) {
    const token = tokens[i]!

    // Handle -- (end of options)
    if (token === '--') {
      if (config.respectsDoubleDash !== false) {
        // Everything after -- is positional; stop validation
        return true
      }
      // If the command doesn't respect --, treat -- as a regular token
      i++
      continue
    }

    // Check if this token is a flag
    if (token.startsWith('-') && FLAG_PATTERN.test(token)) {
      // Parse inline value (split on =)
      let flagName = token
      let inlineValue: string | undefined

      const eqIndex = token.indexOf('=')
      if (eqIndex !== -1) {
        flagName = token.slice(0, eqIndex)
        inlineValue = token.slice(eqIndex + 1)
      }

      // Look up flag in config.safeFlags
      const argType = config.safeFlags[flagName]

      if (argType === undefined) {
        // Flag not in allowlist — check special cases

        // Git numeric shorthand: -1, -2, -3, etc. (e.g., git log -5)
        if (isGit && /^-\d+$/.test(token)) {
          i++
          continue
        }

        // Grep/rg attached numeric: -A20, -B5, -C3, -m100, etc.
        if (isGrepOrRg && /^-[ABCm]\d+$/.test(token)) {
          i++
          continue
        }

        // Bundled short flags: e.g., -rnl means -r -n -l
        // Each char in the bundle must be a 'none' type flag
        if (token.startsWith('-') && !token.startsWith('--') && eqIndex === -1) {
          const bundle = token.slice(1) // strip leading -
          let allNone = true
          for (let c = 0; c < bundle.length; c++) {
            const charFlag = `-${bundle[c]}`
            const charArgType = config.safeFlags[charFlag]
            if (charArgType !== 'none') {
              allNone = false
              break
            }
          }
          if (allNone && bundle.length > 0) {
            i++
            continue
          }
        }

        // Flag not recognized — reject
        return false
      }

      // Flag found in allowlist
      if (argType === 'none') {
        // No argument expected — reject if has = value
        if (inlineValue !== undefined) {
          return false
        }
        i++
        continue
      }

      // Flag takes an argument
      let argValue: string | undefined
      if (inlineValue !== undefined) {
        argValue = inlineValue
      } else {
        // Consume next token as argument
        if (i + 1 >= tokens.length) {
          // No argument provided — reject
          return false
        }
        argValue = tokens[i + 1]!
        i++ // skip the argument token
      }

      // Validate the argument
      if (!validateFlagArgument(argValue, argType)) {
        return false
      }

      // Defense-in-depth: reject string args starting with -
      // Exception: git --sort with reverse sort like -refname
      if (argType === 'string' && argValue.startsWith('-')) {
        if (isGit && (flagName === '--sort' || flagName === '-sort')) {
          // Allow reverse sort prefixes like -refname, -committerdate, etc.
          // These are valid git sort specifications
        } else {
          return false
        }
      }

      i++
      continue
    }

    // Non-flag token (positional argument): allowed, skip
    i++
  }

  return true
}

// ============================================================================
// Command Allowlist
// ============================================================================

export const COMMAND_ALLOWLIST: Record<string, ExternalCommandConfig> = {
  xargs: {
    safeFlags: {
      '-I': '{}',
      '-n': 'number',
      '-P': 'number',
      '-L': 'number',
      '-s': 'number',
      '-E': 'EOF',
      '-0': 'none',
      '-t': 'none',
      '-r': 'none',
      '-x': 'none',
      '-d': 'char',
      '--no-run-if-empty': 'none',
      '--null': 'none',
      '--verbose': 'none',
      '--max-args': 'number',
      '--max-procs': 'number',
      '--max-lines': 'number',
      '--max-chars': 'number',
      '--eof': 'EOF',
      '--delimiter': 'char',
      '--replace': '{}',
    },
  },

  file: {
    safeFlags: {
      '--brief': 'none',
      '-b': 'none',
      '--mime': 'none',
      '-i': 'none',
      '--mime-type': 'none',
      '--mime-encoding': 'none',
      '-L': 'none',
      '--dereference': 'none',
      '-h': 'none',
      '--no-dereference': 'none',
      '-z': 'none',
      '--separator': 'char',
      '-F': 'char',
      '-p': 'none',
      '--preserve-date': 'none',
      '-r': 'none',
      '--raw': 'none',
      '-s': 'none',
      '--special-files': 'none',
      '-v': 'none',
      '--version': 'none',
      '--help': 'none',
      '-0': 'none',
      '--print0': 'none',
      '--exclude': 'string',
      '--magic-file': 'string',
      '-m': 'string',
      '-e': 'string',
      '--exclude-type': 'string',
      '--uncompress': 'none',
      '-Z': 'none',
    },
  },

  sort: {
    safeFlags: {
      '-b': 'none',
      '--ignore-leading-blanks': 'none',
      '-d': 'none',
      '--dictionary-order': 'none',
      '-f': 'none',
      '--ignore-case': 'none',
      '-g': 'none',
      '--general-numeric-sort': 'none',
      '-i': 'none',
      '--ignore-nonprinting': 'none',
      '-M': 'none',
      '--month-sort': 'none',
      '-h': 'none',
      '--human-numeric-sort': 'none',
      '-n': 'none',
      '--numeric-sort': 'none',
      '-R': 'none',
      '--random-sort': 'none',
      '-r': 'none',
      '--reverse': 'none',
      '-V': 'none',
      '--version-sort': 'none',
      '-k': 'string',
      '--key': 'string',
      '-t': 'char',
      '--field-separator': 'char',
      '-s': 'none',
      '--stable': 'none',
      '-u': 'none',
      '--unique': 'none',
      '-c': 'none',
      '--check': 'none',
      '-C': 'none',
      '--check=quiet': 'none',
      '-m': 'none',
      '--merge': 'none',
      '-S': 'string',
      '--buffer-size': 'string',
      '--parallel': 'number',
      '--help': 'none',
      '--version': 'none',
      '-z': 'none',
      '--zero-terminated': 'none',
    },
  },

  grep: {
    safeFlags: {
      '-i': 'none',
      '--ignore-case': 'none',
      '-v': 'none',
      '--invert-match': 'none',
      '-c': 'none',
      '--count': 'none',
      '-l': 'none',
      '--files-with-matches': 'none',
      '-L': 'none',
      '--files-without-match': 'none',
      '-n': 'none',
      '--line-number': 'none',
      '-H': 'none',
      '--with-filename': 'none',
      '-h': 'none',
      '--no-filename': 'none',
      '-o': 'none',
      '--only-matching': 'none',
      '-w': 'none',
      '--word-regexp': 'none',
      '-x': 'none',
      '--line-regexp': 'none',
      '-E': 'none',
      '--extended-regexp': 'none',
      '-F': 'none',
      '--fixed-strings': 'none',
      '-G': 'none',
      '--basic-regexp': 'none',
      '-P': 'none',
      '--perl-regexp': 'none',
      '-e': 'string',
      '--regexp': 'string',
      '-f': 'string',
      '--file': 'string',
      '-m': 'number',
      '--max-count': 'number',
      '-A': 'number',
      '--after-context': 'number',
      '-B': 'number',
      '--before-context': 'number',
      '-C': 'number',
      '--context': 'number',
      '-r': 'none',
      '--recursive': 'none',
      '-R': 'none',
      '--dereference-recursive': 'none',
      '-s': 'none',
      '--no-messages': 'none',
      '-q': 'none',
      '--quiet': 'none',
      '--silent': 'none',
      '--color': 'string',
      '--colour': 'string',
      '--include': 'string',
      '--exclude': 'string',
      '--exclude-dir': 'string',
      '--label': 'string',
      '-T': 'none',
      '--initial-tab': 'none',
      '-Z': 'none',
      '--null': 'none',
      '-a': 'none',
      '--text': 'none',
      '-b': 'none',
      '--byte-offset': 'none',
      '-z': 'none',
      '--null-data': 'none',
      '--help': 'none',
      '--version': 'none',
    },
  },

  ps: {
    safeFlags: {
      '-e': 'none',
      '-A': 'none',
      '-a': 'none',
      '-d': 'none',
      '-N': 'none',
      '--deselect': 'none',
      '-f': 'none',
      '-F': 'none',
      '-l': 'none',
      '-j': 'none',
      '-y': 'none',
      '-w': 'none',
      '--no-headers': 'none',
      '--headers': 'none',
      '-c': 'none',
      '-H': 'none',
      '-L': 'none',
      '-T': 'none',
      '-m': 'none',
      '-o': 'string',
      '--format': 'string',
      '-O': 'string',
      '--sort': 'string',
      '-C': 'string',
      '-G': 'string',
      '-g': 'string',
      '-p': 'string',
      '-s': 'string',
      '-t': 'string',
      '-U': 'string',
      '-u': 'string',
      '-M': 'none',
      '-Z': 'none',
      '--context': 'none',
    },
  },
}

// ============================================================================
// Git read-only subcommands
// ============================================================================

/** Standard git output/format flags shared across many subcommands */
const GIT_COMMON_OUTPUT_FLAGS: Record<string, FlagArgType> = {
  '--format': 'string',
  '--pretty': 'string',
  '--date': 'string',
  '--color': 'string',
  '--no-color': 'none',
  '--abbrev': 'number',
  '--no-abbrev': 'none',
  '--oneline': 'none',
  '-z': 'none',
  '--null': 'none',
}

/** Diff-specific flags */
const GIT_DIFF_FLAGS: Record<string, FlagArgType> = {
  '--stat': 'none',
  '--numstat': 'none',
  '--shortstat': 'none',
  '--dirstat': 'none',
  '--summary': 'none',
  '--patch-with-stat': 'none',
  '--name-only': 'none',
  '--name-status': 'none',
  '--check': 'none',
  '--full-index': 'none',
  '--binary': 'none',
  '--no-prefix': 'none',
  '--src-prefix': 'string',
  '--dst-prefix': 'string',
  '-p': 'none',
  '--patch': 'none',
  '-u': 'none',
  '-s': 'none',
  '--no-patch': 'none',
  '--raw': 'none',
  '--word-diff': 'none',
  '--word-diff-regex': 'string',
  '--color-words': 'none',
  '--color-moved': 'none',
  '--color-moved-ws': 'string',
  '--no-ext-diff': 'none',
  '--ext-diff': 'none',
  '--textconv': 'none',
  '--no-textconv': 'none',
  '-w': 'none',
  '--ignore-all-space': 'none',
  '-b': 'none',
  '--ignore-space-change': 'none',
  '--ignore-blank-lines': 'none',
  '--ignore-space-at-eol': 'none',
  '--ignore-cr-at-eol': 'none',
  '--ignore-submodules': 'none',
  '-M': 'none',
  '--find-renames': 'none',
  '-C': 'none',
  '--find-copies': 'none',
  '--find-copies-harder': 'none',
  '-D': 'none',
  '--irreversible-delete': 'none',
  '-R': 'none',
  '--relative': 'none',
  '-a': 'none',
  '--text': 'none',
  '--histogram': 'none',
  '--patience': 'none',
  '--minimal': 'none',
  '--diff-algorithm': 'string',
  '--diff-filter': 'string',
  '-S': 'string',
  '-G': 'string',
  '--pickaxe-all': 'none',
  '--pickaxe-regex': 'none',
  '-U': 'number',
  '--unified': 'number',
  '--inter-hunk-context': 'number',
  '--output-indicator-new': 'char',
  '--output-indicator-old': 'char',
  '--output-indicator-context': 'char',
  '--cached': 'none',
  '--staged': 'none',
  '--merge-base': 'none',
  '--no-renames': 'none',
  '--compact-summary': 'none',
}

/** Log-specific flags */
const GIT_LOG_FLAGS: Record<string, FlagArgType> = {
  ...GIT_COMMON_OUTPUT_FLAGS,
  ...GIT_DIFF_FLAGS,
  '-n': 'number',
  '--max-count': 'number',
  '--skip': 'number',
  '--since': 'string',
  '--after': 'string',
  '--until': 'string',
  '--before': 'string',
  '--author': 'string',
  '--committer': 'string',
  '--grep': 'string',
  '--all-match': 'none',
  '--invert-grep': 'none',
  '-i': 'none',
  '--regexp-ignore-case': 'none',
  '-E': 'none',
  '--extended-regexp': 'none',
  '-F': 'none',
  '--fixed-strings': 'none',
  '-P': 'none',
  '--perl-regexp': 'none',
  '--merges': 'none',
  '--no-merges': 'none',
  '--min-parents': 'number',
  '--max-parents': 'number',
  '--first-parent': 'none',
  '--not': 'none',
  '--all': 'none',
  '--branches': 'none',
  '--tags': 'none',
  '--remotes': 'none',
  '--glob': 'string',
  '--exclude': 'string',
  '--graph': 'none',
  '--decorate': 'none',
  '--no-decorate': 'none',
  '--decorate-refs': 'string',
  '--decorate-refs-exclude': 'string',
  '--source': 'none',
  '--use-mailmap': 'none',
  '--full-diff': 'none',
  '--log-size': 'none',
  '-L': 'string',
  '--follow': 'none',
  '--topo-order': 'none',
  '--date-order': 'none',
  '--author-date-order': 'none',
  '--reverse': 'none',
  '--ancestry-path': 'none',
  '--simplify-by-decoration': 'none',
  '--simplify-merges': 'none',
  '--full-history': 'none',
  '--dense': 'none',
  '--sparse': 'none',
  '--show-pulls': 'none',
  '--left-right': 'none',
  '--cherry-pick': 'none',
  '--cherry-mark': 'none',
  '--cherry': 'none',
  '--walk-reflogs': 'none',
  '-g': 'none',
  '--boundary': 'none',
  '--count': 'none',
  '--left-only': 'none',
  '--right-only': 'none',
  '--stdin': 'none',
  '--no-walk': 'none',
  '--do-walk': 'none',
  '--show-signature': 'none',
  '--relative-date': 'none',
  '--shortstat': 'none',
}

export const GIT_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig> = {
  diff: {
    safeFlags: {
      ...GIT_COMMON_OUTPUT_FLAGS,
      ...GIT_DIFF_FLAGS,
    },
  },

  log: {
    safeFlags: GIT_LOG_FLAGS,
  },

  show: {
    safeFlags: {
      ...GIT_COMMON_OUTPUT_FLAGS,
      ...GIT_DIFF_FLAGS,
      '--stat': 'none',
      '--no-patch': 'none',
      '-s': 'none',
      '--expand-tabs': 'none',
      '--notes': 'none',
      '--no-notes': 'none',
      '--show-signature': 'none',
    },
  },

  status: {
    safeFlags: {
      '-s': 'none',
      '--short': 'none',
      '-b': 'none',
      '--branch': 'none',
      '--show-stash': 'none',
      '--porcelain': 'none',
      '--long': 'none',
      '-u': 'none',
      '--untracked-files': 'none',
      '--ignored': 'none',
      '--ignore-submodules': 'none',
      '-z': 'none',
      '--column': 'none',
      '--no-column': 'none',
      '--ahead-behind': 'none',
      '--no-ahead-behind': 'none',
      '--renames': 'none',
      '--no-renames': 'none',
      '--find-renames': 'none',
      '-v': 'none',
      '--verbose': 'none',
    },
  },

  blame: {
    safeFlags: {
      ...GIT_COMMON_OUTPUT_FLAGS,
      '-L': 'string',
      '-l': 'none',
      '-t': 'none',
      '-e': 'none',
      '--show-email': 'none',
      '-w': 'none',
      '-M': 'none',
      '-C': 'none',
      '--since': 'string',
      '-S': 'string',
      '--reverse': 'none',
      '-p': 'none',
      '--porcelain': 'none',
      '--line-porcelain': 'none',
      '--incremental': 'none',
      '--root': 'none',
      '--show-stats': 'none',
      '--score-debug': 'none',
      '-f': 'none',
      '--show-name': 'none',
      '-n': 'none',
      '--show-number': 'none',
      '-s': 'none',
      '--no-progress': 'none',
    },
  },

  'ls-files': {
    safeFlags: {
      '-c': 'none',
      '--cached': 'none',
      '-d': 'none',
      '--deleted': 'none',
      '-m': 'none',
      '--modified': 'none',
      '-o': 'none',
      '--others': 'none',
      '-i': 'none',
      '--ignored': 'none',
      '-s': 'none',
      '--stage': 'none',
      '-u': 'none',
      '--unmerged': 'none',
      '-k': 'none',
      '--killed': 'none',
      '-z': 'none',
      '--exclude': 'string',
      '-x': 'string',
      '--exclude-from': 'string',
      '-X': 'string',
      '--exclude-per-directory': 'string',
      '--exclude-standard': 'none',
      '--error-unmatch': 'none',
      '--with-tree': 'string',
      '-t': 'none',
      '-v': 'none',
      '--full-name': 'none',
      '--recurse-submodules': 'none',
      '--abbrev': 'number',
      '--debug': 'none',
      '--eol': 'none',
      '--deduplicate': 'none',
      '--sparse': 'none',
      '--format': 'string',
    },
  },

  remote: {
    safeFlags: {
      '-v': 'none',
      '--verbose': 'none',
    },
    additionalCommandIsDangerousCallback: (_rawCommand: string, args: string[]): boolean => {
      // Only allow: git remote (no args), git remote -v, git remote show <name>,
      // git remote get-url <name>
      if (args.length === 0) return false
      const subCmd = args[0]
      if (subCmd === 'show' || subCmd === 'get-url') return false
      if (subCmd === '-v' || subCmd === '--verbose') return false
      // Any other subcommand (add, remove, rename, set-url, etc.) is dangerous
      return true
    },
  },

  'merge-base': {
    safeFlags: {
      '-a': 'none',
      '--all': 'none',
      '--octopus': 'none',
      '--independent': 'none',
      '--is-ancestor': 'none',
      '--fork-point': 'none',
    },
  },

  'rev-parse': {
    safeFlags: {
      '--git-dir': 'none',
      '--git-common-dir': 'none',
      '--resolve-git-dir': 'string',
      '--git-path': 'string',
      '--show-toplevel': 'none',
      '--show-superproject-working-tree': 'none',
      '--show-prefix': 'none',
      '--show-cdup': 'none',
      '--show-object-format': 'none',
      '--is-inside-git-dir': 'none',
      '--is-inside-work-tree': 'none',
      '--is-bare-repository': 'none',
      '--is-shallow-repository': 'none',
      '--parseopt': 'none',
      '--sq-quote': 'none',
      '--sq': 'none',
      '--short': 'none',
      '--verify': 'none',
      '--symbolic': 'none',
      '--symbolic-full-name': 'none',
      '--abbrev-ref': 'none',
      '--all': 'none',
      '--branches': 'none',
      '--tags': 'none',
      '--remotes': 'none',
      '--glob': 'string',
      '--exclude': 'string',
      '--disambiguate': 'string',
      '--absolute-git-dir': 'none',
      '--shared-index-path': 'none',
      '--local-env-vars': 'none',
      '--path-format': 'string',
    },
  },

  'rev-list': {
    safeFlags: {
      ...GIT_LOG_FLAGS,
      '--objects': 'none',
      '--objects-edge': 'none',
      '--objects-edge-aggressive': 'none',
      '--indexed-objects': 'none',
      '--unpacked': 'none',
      '--filter': 'string',
      '--filter-provided-objects': 'none',
      '--filter-print-omitted': 'none',
      '--missing': 'string',
      '--use-bitmap-index': 'none',
      '--progress': 'string',
      '--count': 'none',
      '--quiet': 'none',
      '--disk-usage': 'none',
      '--header': 'none',
      '--timestamp': 'none',
      '--parents': 'none',
      '--children': 'none',
      '--in-commit-order': 'none',
      '--bisect': 'none',
      '--bisect-vars': 'none',
      '--bisect-all': 'none',
    },
  },

  describe: {
    safeFlags: {
      '--dirty': 'none',
      '--broken': 'none',
      '--all': 'none',
      '--tags': 'none',
      '--contains': 'none',
      '--abbrev': 'number',
      '--candidates': 'number',
      '--exact-match': 'none',
      '--debug': 'none',
      '--long': 'none',
      '--match': 'string',
      '--exclude': 'string',
      '--always': 'none',
      '--first-parent': 'none',
    },
  },

  'cat-file': {
    safeFlags: {
      '-t': 'none',
      '-s': 'none',
      '-e': 'none',
      '-p': 'none',
      '--textconv': 'none',
      '--filters': 'none',
      '--path': 'string',
      '--batch': 'none',
      '--batch-check': 'none',
      '--batch-command': 'none',
      '--batch-all-objects': 'none',
      '--buffer': 'none',
      '--unordered': 'none',
      '--allow-unknown-type': 'none',
      '--follow-symlinks': 'none',
      '-Z': 'none',
    },
  },

  'for-each-ref': {
    safeFlags: {
      '--format': 'string',
      '--sort': 'string',
      '--count': 'number',
      '--shell': 'none',
      '--perl': 'none',
      '--python': 'none',
      '--tcl': 'none',
      '--points-at': 'string',
      '--merged': 'string',
      '--no-merged': 'string',
      '--contains': 'string',
      '--no-contains': 'string',
      '--color': 'string',
      '--no-color': 'none',
      '--omit-empty': 'none',
    },
  },

  grep: {
    safeFlags: {
      ...GIT_COMMON_OUTPUT_FLAGS,
      '-i': 'none',
      '--ignore-case': 'none',
      '-v': 'none',
      '--invert-match': 'none',
      '-w': 'none',
      '--word-regexp': 'none',
      '-h': 'none',
      '-H': 'none',
      '--full-name': 'none',
      '-E': 'none',
      '--extended-regexp': 'none',
      '-G': 'none',
      '--basic-regexp': 'none',
      '-P': 'none',
      '--perl-regexp': 'none',
      '-F': 'none',
      '--fixed-strings': 'none',
      '-n': 'none',
      '--line-number': 'none',
      '--column': 'none',
      '-l': 'none',
      '--files-with-matches': 'none',
      '--name-only': 'none',
      '-L': 'none',
      '--files-without-match': 'none',
      '-c': 'none',
      '--count': 'none',
      '-o': 'none',
      '--only-matching': 'none',
      '-e': 'string',
      '-f': 'string',
      '--and': 'none',
      '--or': 'none',
      '--not': 'none',
      '--all-match': 'none',
      '-q': 'none',
      '--quiet': 'none',
      '--max-depth': 'number',
      '-r': 'none',
      '--recurse-submodules': 'none',
      '--untracked': 'none',
      '--no-index': 'none',
      '--cached': 'none',
      '--no-exclude-standard': 'none',
      '-A': 'number',
      '--after-context': 'number',
      '-B': 'number',
      '--before-context': 'number',
      '-C': 'number',
      '--context': 'number',
      '-p': 'none',
      '--show-function': 'none',
      '-W': 'none',
      '--function-context': 'none',
      '--threads': 'number',
      '--break': 'none',
      '--heading': 'none',
    },
  },

  'stash show': {
    safeFlags: {
      ...GIT_DIFF_FLAGS,
      ...GIT_COMMON_OUTPUT_FLAGS,
      '-u': 'none',
      '--include-untracked': 'none',
      '--only-untracked': 'none',
    },
  },

  'stash list': {
    safeFlags: {
      ...GIT_LOG_FLAGS,
    },
  },

  'worktree list': {
    safeFlags: {
      '--porcelain': 'none',
      '-v': 'none',
      '--verbose': 'none',
      '--expire': 'string',
      '-z': 'none',
    },
  },

  tag: {
    safeFlags: {
      '-l': 'none',
      '--list': 'none',
      '-n': 'number',
      '--sort': 'string',
      '--format': 'string',
      '--color': 'string',
      '--no-color': 'none',
      '--contains': 'string',
      '--no-contains': 'string',
      '--merged': 'string',
      '--no-merged': 'string',
      '--points-at': 'string',
      '-i': 'none',
      '--ignore-case': 'none',
      '--column': 'none',
      '--no-column': 'none',
      '--omit-empty': 'none',
    },
    additionalCommandIsDangerousCallback: (_rawCommand: string, args: string[]): boolean => {
      // tag is read-only only in list mode (-l/--list, or no flags with pattern)
      // If there are args that look like tag creation (-a, -s, -m, -d, etc.), it's dangerous
      for (const arg of args) {
        if (arg === '-a' || arg === '--annotate') return true
        if (arg === '-s' || arg === '--sign') return true
        if (arg === '-d' || arg === '--delete') return true
        if (arg === '-m' || arg === '--message') return true
        if (arg === '-F' || arg === '--file') return true
        if (arg === '-f' || arg === '--force') return true
        if (arg === '-u' || arg === '--local-user') return true
        if (arg === '--cleanup') return true
        if (arg === '--create-reflog') return true
      }
      return false
    },
  },

  branch: {
    safeFlags: {
      '-l': 'none',
      '--list': 'none',
      '-a': 'none',
      '--all': 'none',
      '-r': 'none',
      '--remotes': 'none',
      '-v': 'none',
      '-vv': 'none',
      '--verbose': 'none',
      '--sort': 'string',
      '--format': 'string',
      '--color': 'string',
      '--no-color': 'none',
      '--contains': 'string',
      '--no-contains': 'string',
      '--merged': 'string',
      '--no-merged': 'string',
      '--points-at': 'string',
      '-i': 'none',
      '--ignore-case': 'none',
      '--column': 'none',
      '--no-column': 'none',
      '--abbrev': 'number',
      '--no-abbrev': 'none',
      '--show-current': 'none',
      '--omit-empty': 'none',
    },
    additionalCommandIsDangerousCallback: (_rawCommand: string, args: string[]): boolean => {
      // branch is read-only only in list mode
      // If there are args that look like creation/deletion/rename, it's dangerous
      for (const arg of args) {
        if (arg === '-d' || arg === '--delete') return true
        if (arg === '-D') return true
        if (arg === '-m' || arg === '--move') return true
        if (arg === '-M') return true
        if (arg === '-c' || arg === '--copy') return true
        if (arg === '-C') return true
        if (arg === '--set-upstream-to') return true
        if (arg === '-u' || arg === '--unset-upstream') return true
        if (arg === '--edit-description') return true
        if (arg === '-f' || arg === '--force') return true
        if (arg.startsWith('--set-upstream-to=')) return true
        if (arg === '--track' || arg === '--no-track') return true
      }
      return false
    },
  },

  shortlog: {
    safeFlags: {
      ...GIT_LOG_FLAGS,
      '-s': 'none',
      '--summary': 'none',
      '-n': 'number',
      '--numbered': 'none',
      '-e': 'none',
      '--email': 'none',
      '-w': 'none',
      '--group': 'string',
      '-c': 'none',
      '--committer': 'none',
    },
  },

  reflog: {
    safeFlags: {
      ...GIT_LOG_FLAGS,
    },
    additionalCommandIsDangerousCallback: (_rawCommand: string, args: string[]): boolean => {
      // reflog is read-only only for 'show' (the default) or explicit 'show'
      if (args.length === 0) return false
      const subCmd = args[0]
      if (subCmd === 'show') return false
      // Any other reflog subcommand (expire, delete) is dangerous
      if (subCmd === 'expire' || subCmd === 'delete') return true
      // If it looks like a ref (doesn't start with -), it's a show argument
      if (subCmd && !subCmd.startsWith('-')) {
        // Could be 'git reflog HEAD' which is equivalent to 'git reflog show HEAD'
        return false
      }
      return false
    },
  },

  'ls-remote': {
    safeFlags: {
      '-h': 'none',
      '--heads': 'none',
      '-t': 'none',
      '--tags': 'none',
      '--refs': 'none',
      '--get-url': 'none',
      '--sort': 'string',
      '-o': 'string',
      '--server-option': 'string',
      '--symref': 'none',
      '-q': 'none',
      '--quiet': 'none',
      '--exit-code': 'none',
    },
  },
}

// ============================================================================
// Unquoted expansion detection
// ============================================================================

/**
 * Track single-quote, double-quote, and escape state character by character
 * to detect dangerous unquoted expansions.
 *
 * Rejects:
 * - $ followed by [A-Za-z_@*#?!$0-9-] outside quotes (variable expansion)
 * - Glob characters [?*[\]] outside both single AND double quotes
 *
 * Returns true if dangerous expansion is found.
 */
export function containsUnquotedExpansion(command: string): boolean {
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!

    // Handle escape state
    if (escaped) {
      escaped = false
      continue
    }

    // Backslash escape (not inside single quotes)
    if (ch === '\\' && !inSingleQuote) {
      escaped = true
      continue
    }

    // Single quote toggle (not inside double quotes)
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    // Double quote toggle (not inside single quotes)
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    // Inside single quotes, everything is literal
    if (inSingleQuote) {
      continue
    }

    // Check for variable expansion outside quotes
    if (ch === '$' && !inSingleQuote && !inDoubleQuote) {
      const next = command[i + 1]
      if (next && /[A-Za-z_@*#?!$0-9-]/.test(next)) {
        return true
      }
    }

    // Check for glob characters outside both single AND double quotes
    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '?' || ch === '*' || ch === '[' || ch === ']') {
        return true
      }
    }
  }

  return false
}

// ============================================================================
// Simple read-only command regexes
// ============================================================================

const SIMPLE_READONLY_COMMANDS = [
  'cal', 'uptime', 'cat', 'head', 'tail', 'wc', 'stat', 'strings',
  'hexdump', 'od', 'nl', 'id', 'uname', 'free', 'df', 'du', 'locale',
  'groups', 'nproc', 'basename', 'dirname', 'realpath', 'readlink',
  'cut', 'paste', 'tr', 'column', 'tac', 'rev', 'fold', 'expand',
  'unexpand', 'fmt', 'comm', 'cmp', 'numfmt', 'diff', 'true', 'false',
  'sleep', 'which', 'type', 'expr', 'test', 'getconf', 'seq', 'tsort', 'pr',
]

/** Build regexes for simple read-only commands: /^{cmd}(?:\s+[^<>()$`|{}&;\n\r]*)?$/ */
const SIMPLE_READONLY_REGEXES: RegExp[] = SIMPLE_READONLY_COMMANDS.map(
  cmd => new RegExp(`^${cmd}(?:\\s+[^<>()$\`|{}&;\\n\\r]*)?$`),
)

const READONLY_COMMAND_REGEXES: RegExp[] = [
  // echo with safe quoting
  /^echo(?:\s+(?:'[^']*'|"[^"$<>\n\r]*"|[^|;&`$(){}><#\\!"'\s]+))*(?:\s+2>&1)?\s*$/,
  // Simple commands
  /^pwd$/, /^whoami$/,
  /^node -v$/, /^node --version$/,
  /^python --version$/, /^python3 --version$/,
  /^history(?:\s+\d+)?\s*$/, /^alias$/,
  /^arch(?:\s+(?:--help|-h))?\s*$/,
  /^ip addr$/, /^ifconfig(?:\s+[a-zA-Z][a-zA-Z0-9_-]*)?\s*$/,
  // cd (simple paths)
  /^cd(?:\s+(?:'[^']*'|"[^"]*"|[^\s;|&`$(){}><#\\]+))?$/,
  // ls (no dangerous chars)
  /^ls(?:\s+[^<>()$`|{}&;\n\r]*)?$/,
  // find (no -exec/-delete)
  /^find(?:\s+(?:\\[()]|(?!-delete\b|-exec\b|-execdir\b|-ok\b|-okdir\b|-fprint0?\b|-fls\b|-fprintf\b)[^<>()$`|{}&;\n\r\s]|\s)+)?$/,
  // Simple read-only commands
  ...SIMPLE_READONLY_REGEXES,
]

// ============================================================================
// Tokenizer for flag parsing
// ============================================================================

/**
 * Simple whitespace-split tokenizer that respects single and double quotes.
 * Returns an array of tokens with quotes stripped from values.
 */
function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!

    if (escaped) {
      current += ch
      escaped = false
      continue
    }

    if (ch === '\\' && !inSingleQuote) {
      escaped = true
      current += ch
      continue
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      current += ch
      continue
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += ch
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += ch
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Strip quotes from a token value (for comparison purposes).
 */
function stripQuotes(token: string): string {
  let result = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < token.length; i++) {
    const ch = token[i]!

    if (escaped) {
      result += ch
      escaped = false
      continue
    }

    if (ch === '\\' && !inSingleQuote) {
      escaped = true
      continue
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    result += ch
  }

  return result
}

// ============================================================================
// Flag-based command validation
// ============================================================================

/**
 * Check whether a command is safe via flag parsing against the COMMAND_ALLOWLIST
 * and GIT_READ_ONLY_COMMANDS.
 *
 * Returns true if the command is recognized and all its flags are safe.
 */
export function isCommandSafeViaFlagParsing(command: string): boolean {
  const tokens = tokenize(command)
  if (tokens.length === 0) return false

  // Reject tokens with $ (variable expansion)
  for (const token of tokens) {
    const stripped = stripQuotes(token)
    if (stripped.includes('$')) {
      return false
    }
  }

  // Reject tokens with brace expansion: { + (, or ..)
  for (const token of tokens) {
    const stripped = stripQuotes(token)
    if (stripped.includes('{')) {
      if (stripped.includes(',') || stripped.includes('..')) {
        return false
      }
    }
  }

  const baseCommand = stripQuotes(tokens[0]!)

  // Check if it's a git command
  if (baseCommand === 'git') {
    return isGitCommandSafeViaFlagParsing(tokens)
  }

  // Check against COMMAND_ALLOWLIST
  const config = COMMAND_ALLOWLIST[baseCommand]
  if (!config) return false

  const isGrepOrRg = baseCommand === 'grep' || baseCommand === 'rg'

  const flagsValid = validateFlags(tokens, 1, config, { isGrepOrRg })
  if (!flagsValid) return false

  // Run additional dangerous callback if present
  if (config.additionalCommandIsDangerousCallback) {
    const args = tokens.slice(1).map(stripQuotes)
    if (config.additionalCommandIsDangerousCallback(command, args)) {
      return false
    }
  }

  // Block backticks and newlines/CR in grep/rg patterns
  if (isGrepOrRg) {
    for (const token of tokens.slice(1)) {
      const stripped = stripQuotes(token)
      if (stripped.includes('`') || stripped.includes('\n') || stripped.includes('\r')) {
        return false
      }
    }
  }

  return true
}

/**
 * Handle git commands: look up the subcommand in GIT_READ_ONLY_COMMANDS.
 */
function isGitCommandSafeViaFlagParsing(tokens: string[]): boolean {
  if (tokens.length < 2) return false

  // Skip any git global flags before the subcommand
  // Global flags we need to block: -c, --exec-path, --config-env
  let subCmdIndex = 1
  while (subCmdIndex < tokens.length) {
    const token = stripQuotes(tokens[subCmdIndex]!)
    if (token === '-c' || token === '--exec-path' || token.startsWith('--exec-path=') ||
        token === '--config-env' || token.startsWith('--config-env=')) {
      return false
    }
    // Skip known safe global flags
    if (token === '--no-pager' || token === '--no-replace-objects' ||
        token === '--bare' || token === '--literal-pathspecs' ||
        token === '--no-optional-locks' || token === '--no-lazy-fetch') {
      subCmdIndex++
      continue
    }
    if (token.startsWith('--git-dir=') || token.startsWith('--work-tree=')) {
      subCmdIndex++
      continue
    }
    if (token === '--git-dir' || token === '--work-tree') {
      subCmdIndex += 2 // skip flag and its argument
      continue
    }
    // Not a global flag — this should be the subcommand
    break
  }

  if (subCmdIndex >= tokens.length) return false

  const subCommand = stripQuotes(tokens[subCmdIndex]!)

  // Check for multi-word subcommands (e.g., "stash show", "stash list", "worktree list")
  let config: ExternalCommandConfig | undefined
  let flagStartIndex = subCmdIndex + 1

  if (subCmdIndex + 1 < tokens.length) {
    const nextToken = stripQuotes(tokens[subCmdIndex + 1]!)
    const multiWord = `${subCommand} ${nextToken}`
    config = GIT_READ_ONLY_COMMANDS[multiWord]
    if (config) {
      flagStartIndex = subCmdIndex + 2
    }
  }

  if (!config) {
    config = GIT_READ_ONLY_COMMANDS[subCommand]
    flagStartIndex = subCmdIndex + 1
  }

  if (!config) return false

  const isGrepOrRg = subCommand === 'grep'

  const flagsValid = validateFlags(tokens, flagStartIndex, config, { isGit: true, isGrepOrRg })
  if (!flagsValid) return false

  // Run additional dangerous callback if present
  if (config.additionalCommandIsDangerousCallback) {
    const rawCommand = tokens.join(' ')
    const args = tokens.slice(flagStartIndex).map(stripQuotes)
    if (config.additionalCommandIsDangerousCallback(rawCommand, args)) {
      return false
    }
  }

  // Block backticks and newlines/CR in git grep patterns
  if (isGrepOrRg) {
    for (const token of tokens.slice(flagStartIndex)) {
      const stripped = stripQuotes(token)
      if (stripped.includes('`') || stripped.includes('\n') || stripped.includes('\r')) {
        return false
      }
    }
  }

  return true
}

// ============================================================================
// Command read-only detection
// ============================================================================

/**
 * Check whether a single command (not compound) is read-only.
 *
 * A command is read-only if:
 * 1. It passes unquoted expansion checks
 * 2. It matches a flag-based allowlist (COMMAND_ALLOWLIST or GIT_READ_ONLY_COMMANDS)
 * 3. OR it matches one of the READONLY_COMMAND_REGEXES patterns
 */
export function isCommandReadOnly(command: string): boolean {
  let cmd = command.trim()

  // Handle 2>&1 stderr redirection at end
  if (cmd.endsWith('2>&1')) {
    cmd = cmd.slice(0, -4).trim()
  }

  // Check for unquoted expansion — reject if found
  if (containsUnquotedExpansion(cmd)) {
    return false
  }

  // Try flag-based validation first
  if (isCommandSafeViaFlagParsing(cmd)) {
    return true
  }

  // Check against READONLY_COMMAND_REGEXES
  for (const regex of READONLY_COMMAND_REGEXES) {
    if (regex.test(cmd)) {
      return true
    }
  }

  // Block git -c, --exec-path, --config-env flags
  if (/^git\s/.test(cmd)) {
    const tokens = tokenize(cmd)
    for (let i = 1; i < tokens.length; i++) {
      const token = stripQuotes(tokens[i]!)
      if (token === '-c' || token === '--exec-path' || token.startsWith('--exec-path=') ||
          token === '--config-env' || token.startsWith('--config-env=')) {
        return false
      }
    }
  }

  return false
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Check whether a command satisfies read-only constraints.
 *
 * This is the main exported function used by the permission system.
 *
 * - First runs bashCommandIsSafe security checks. If it returns 'ask', propagate.
 * - Splits the command into subcommands (handling &&, ||, |, ;).
 * - Checks each subcommand is read-only via isCommandReadOnly.
 * - If ALL subcommands are read-only, returns allow.
 * - Otherwise returns passthrough so downstream permission checks can decide.
 */
export function checkReadOnlyConstraints(
  input: { command: string },
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  // Run security checks first
  const securityResult = bashCommandIsSafe(input.command)
  if (securityResult.behavior === 'ask') {
    return securityResult
  }

  // Split into subcommands
  const subcommands = splitCommand(input.command)

  // Check each subcommand is read-only
  for (const sub of subcommands) {
    const trimmed = sub.trim()
    if (trimmed.length === 0) continue

    if (!isCommandReadOnly(trimmed)) {
      return {
        behavior: 'passthrough',
        message: 'Command is not read-only',
      }
    }
  }

  // All subcommands are read-only
  return {
    behavior: 'allow',
    updatedInput: { command: input.command },
  }
}
