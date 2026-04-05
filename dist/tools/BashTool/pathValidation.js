/**
 * Path extraction and validation for bash commands.
 *
 * Extracts file paths from known commands (cd, ls, grep, sed, etc.) and
 * validates them against the allowed working directories. Also detects
 * dangerous removal targets (system directories) that should never be
 * auto-allowed.
 *
 * Design:
 * - PATH_EXTRACTORS: maps each known command to a function that extracts
 *   the file-path arguments from the tokenized args.
 * - COMMAND_OPERATION_TYPE: classifies each command as read / write / create.
 * - validateCommandPaths: main per-command validator.
 * - checkPathConstraints: top-level entry point called from the permission chain.
 */
import { homedir } from 'os';
import { resolve, isAbsolute } from 'path';
import { pathInWorkingPath } from '../../utils/permissions/filesystem.js';
import { splitCommand } from '../../utils/bash/commands.js';
// ============================================================================
// Helpers
// ============================================================================
function passthrough(message) {
    return { behavior: 'passthrough', message };
}
function ask(message) {
    return { behavior: 'ask', message };
}
// ============================================================================
// 3. filterOutFlags
// ============================================================================
/**
 * Filter flag arguments from an args array.
 *
 * Handles the `--` (end-of-options) marker: everything after `--` is treated
 * as a positional argument even if it starts with `-`.
 *
 * @param args - Tokenized argument list (command name already removed)
 * @returns Non-flag positional arguments
 */
export function filterOutFlags(args) {
    const result = [];
    let endOfOptions = false;
    for (const arg of args) {
        if (endOfOptions) {
            result.push(arg);
            continue;
        }
        if (arg === '--') {
            endOfOptions = true;
            continue;
        }
        if (arg.startsWith('-')) {
            continue;
        }
        result.push(arg);
    }
    return result;
}
// ============================================================================
// 4. parsePatternCommand
// ============================================================================
/**
 * Flags for grep/rg that consume the next argument (i.e. the next token is
 * NOT a file path).
 */
const PATTERN_COMMAND_ARG_FLAGS = new Set([
    '-e', '-f', '-m',
    '-A', '-B', '-C',
    '--regexp', '--file', '--max-count',
    '--after-context', '--before-context', '--context',
    '--include', '--exclude', '--exclude-dir',
    '--color', '--colours', '--colors',
    '--label', '--binary-files',
    '-d', '--directories',
    '-D', '--devices',
    '--exclude-from', '--include-from',
    '--type-add', '--type-not',
    '-g', '--glob',
    '-t', '--type',
    '-T', '--type-not',
    '--iglob',
    '--max-depth', '--maxdepth',
    '--threads', '-j',
    '--sort', '--sortr',
    '-M', '--max-columns',
    '--max-filesize',
    '--path-separator',
    '--pre', '--pre-glob',
    '--replace', '-r',
    '--regex-size-limit', '--dfa-size-limit',
]);
/**
 * Parse paths from grep/rg style commands.
 *
 * The first non-flag argument is the pattern (skip it), the rest are file
 * paths. If no paths are found and hasRecursiveFlag is true, return `['.']`
 * (search current directory).
 *
 * @param args - Tokenized argument list (command name already removed)
 * @param hasRecursiveFlag - Whether `-r`, `-R`, or `--recursive` was present
 * @returns Array of file paths
 */
export function parsePatternCommand(args, hasRecursiveFlag) {
    const paths = [];
    let patternSkipped = false;
    let endOfOptions = false;
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (endOfOptions) {
            if (!patternSkipped) {
                patternSkipped = true;
                i++;
                continue;
            }
            paths.push(arg);
            i++;
            continue;
        }
        if (arg === '--') {
            endOfOptions = true;
            i++;
            continue;
        }
        // Flag that consumes the next argument
        if (PATTERN_COMMAND_ARG_FLAGS.has(arg)) {
            i += 2; // skip flag and its value
            continue;
        }
        // Flag (starts with -)
        if (arg.startsWith('-')) {
            i++;
            continue;
        }
        // First positional arg is the pattern
        if (!patternSkipped) {
            patternSkipped = true;
            i++;
            continue;
        }
        // Subsequent positional args are file paths
        paths.push(arg);
        i++;
    }
    if (paths.length === 0 && hasRecursiveFlag) {
        return ['.'];
    }
    return paths;
}
// ============================================================================
// 5. PATH_EXTRACTORS
// ============================================================================
/**
 * Find-specific flags that should NOT be treated as paths.
 * When we encounter a token starting with `-` that is one of these,
 * we stop collecting paths.
 */
const FIND_TEST_FLAGS = new Set([
    '-name', '-iname', '-type', '-maxdepth', '-mindepth',
    '-newer', '-path', '-wholename', '-ipath', '-iwholename',
    '-regex', '-iregex', '-size', '-mtime', '-atime', '-ctime',
    '-mmin', '-amin', '-cmin', '-perm', '-user', '-group',
    '-uid', '-gid', '-nouser', '-nogroup', '-links',
    '-inum', '-samefile', '-exec', '-execdir', '-ok', '-okdir',
    '-print', '-print0', '-printf', '-fprint', '-fprint0', '-fprintf',
    '-ls', '-fls', '-delete', '-prune', '-quit',
    '-empty', '-true', '-false', '-readable', '-writable', '-executable',
    '-follow', '-mount', '-xdev', '-depth', '-daystart',
    '-warn', '-nowarn', '-ignore_readdir_race', '-noignore_readdir_race',
    '-not', '-and', '-or', '-a', '-o',
]);
/** Find flags that consume the next argument (the next token is a value, not a path). */
const FIND_ARG_FLAGS = new Set([
    '-newer', '-path', '-wholename', '-ipath', '-iwholename',
    '-name', '-iname', '-type', '-maxdepth', '-mindepth',
    '-regex', '-iregex', '-size', '-mtime', '-atime', '-ctime',
    '-mmin', '-amin', '-cmin', '-perm', '-user', '-group',
    '-uid', '-gid', '-links', '-inum', '-samefile',
    '-printf', '-fprint', '-fprint0', '-fprintf', '-fls',
]);
/**
 * Map from each recognized PathCommand to a function that extracts file-path
 * arguments from the tokenized args array (command name already removed).
 */
export const PATH_EXTRACTORS = {
    cd(args) {
        if (args.length === 0)
            return [homedir()];
        return [args.join(' ')];
    },
    ls(args) {
        const paths = filterOutFlags(args);
        return paths.length > 0 ? paths : ['.'];
    },
    find(args) {
        const paths = [];
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            // If arg starts with '-' and is a known find test/action flag, stop collecting paths
            if (arg.startsWith('-') && FIND_TEST_FLAGS.has(arg)) {
                // If this flag takes an argument, skip the next token too
                if (FIND_ARG_FLAGS.has(arg)) {
                    i += 2;
                }
                else {
                    i++;
                }
                continue;
            }
            // If arg starts with '(' or '!' or '\(', stop collecting paths (expression start)
            if (arg === '(' || arg === ')' || arg === '!' || arg === '\\(' || arg === '\\)') {
                i++;
                continue;
            }
            // If arg starts with '-' but is NOT a known flag, it's an expression we don't
            // recognize — stop collecting paths to be safe
            if (arg.startsWith('-')) {
                break;
            }
            // This is a path argument
            paths.push(arg);
            i++;
        }
        return paths.length > 0 ? paths : ['.'];
    },
    mkdir(args) { return filterOutFlags(args); },
    touch(args) { return filterOutFlags(args); },
    rm(args) { return filterOutFlags(args); },
    rmdir(args) { return filterOutFlags(args); },
    mv(args) { return filterOutFlags(args); },
    cp(args) { return filterOutFlags(args); },
    cat(args) { return filterOutFlags(args); },
    head(args) { return filterOutFlags(args); },
    tail(args) { return filterOutFlags(args); },
    sort(args) { return filterOutFlags(args); },
    uniq(args) { return filterOutFlags(args); },
    wc(args) { return filterOutFlags(args); },
    cut(args) { return filterOutFlags(args); },
    paste(args) { return filterOutFlags(args); },
    column(args) { return filterOutFlags(args); },
    file(args) { return filterOutFlags(args); },
    stat(args) { return filterOutFlags(args); },
    diff(args) { return filterOutFlags(args); },
    awk(args) { return filterOutFlags(args); },
    strings(args) { return filterOutFlags(args); },
    hexdump(args) { return filterOutFlags(args); },
    od(args) { return filterOutFlags(args); },
    base64(args) { return filterOutFlags(args); },
    nl(args) { return filterOutFlags(args); },
    sha256sum(args) { return filterOutFlags(args); },
    sha1sum(args) { return filterOutFlags(args); },
    md5sum(args) { return filterOutFlags(args); },
    tr(args) {
        // tr takes two character-set arguments first, then optional file paths
        // Usage: tr [OPTION]... SET1 [SET2] [FILE]...
        const nonFlags = filterOutFlags(args);
        // Skip the first two positional args (character sets)
        if (nonFlags.length <= 2)
            return [];
        return nonFlags.slice(2);
    },
    grep(args) {
        const hasRecursive = args.some(a => a === '-r' || a === '-R' || a === '--recursive' ||
            (a.startsWith('-') && !a.startsWith('--') && (a.includes('r') || a.includes('R'))));
        return parsePatternCommand(args, hasRecursive);
    },
    rg(args) {
        // rg is recursive by default
        const paths = parsePatternCommand(args, true);
        return paths;
    },
    sed(args) {
        const paths = [];
        let i = 0;
        let expressionConsumed = false;
        while (i < args.length) {
            const arg = args[i];
            // -f takes a script file argument
            if (arg === '-f' || arg === '--file') {
                if (i + 1 < args.length) {
                    paths.push(args[i + 1]);
                }
                i += 2;
                expressionConsumed = true;
                continue;
            }
            // -e takes an expression argument (skip it — not a file path)
            if (arg === '-e' || arg === '--expression') {
                i += 2;
                expressionConsumed = true;
                continue;
            }
            // --expression=value or -e=value
            if (arg.startsWith('--expression=') || arg.startsWith('-e=')) {
                expressionConsumed = true;
                i++;
                continue;
            }
            // Skip other flags
            if (arg.startsWith('-')) {
                i++;
                continue;
            }
            // First positional arg is the inline expression (if no -e was used)
            if (!expressionConsumed) {
                expressionConsumed = true;
                i++;
                continue;
            }
            // Remaining positional args are file paths
            paths.push(arg);
            i++;
        }
        return paths;
    },
    git(args) {
        // Only handle `git diff --no-index` — extract exactly 2 file paths
        if (args.length < 3)
            return [];
        // Look for "diff" subcommand with --no-index
        if (args[0] !== 'diff')
            return [];
        const noIndexIdx = args.indexOf('--no-index');
        if (noIndexIdx === -1)
            return [];
        // Collect the two file paths after --no-index (skip flags)
        const filePaths = [];
        for (let i = noIndexIdx + 1; i < args.length && filePaths.length < 2; i++) {
            const arg = args[i];
            if (arg.startsWith('-'))
                continue;
            filePaths.push(arg);
        }
        return filePaths;
    },
    jq(args) {
        const paths = [];
        let i = 0;
        let filterConsumed = false;
        let argsMode = false; // after --args or --jsonargs
        /** Flags that consume the next token as a value */
        const jqArgFlags = new Set([
            '-f', '--from-file',
            '--arg', '--argjson', '--slurpfile', '--rawfile',
            '-L', '--library-path',
            '--indent',
        ]);
        /** Flags that consume two subsequent tokens */
        const jqDoubleArgFlags = new Set([
            '--arg', '--argjson', '--slurpfile', '--rawfile',
        ]);
        while (i < args.length) {
            const arg = args[i];
            // --args / --jsonargs: everything after is positional values, not files
            if (arg === '--args' || arg === '--jsonargs') {
                argsMode = true;
                i++;
                continue;
            }
            if (argsMode) {
                // In --args/--jsonargs mode, remaining tokens are values, not files
                i++;
                continue;
            }
            // -f / --from-file: next arg is a file path
            if (arg === '-f' || arg === '--from-file') {
                if (i + 1 < args.length) {
                    paths.push(args[i + 1]);
                }
                filterConsumed = true;
                i += 2;
                continue;
            }
            // Flags that consume two arguments (name + value)
            if (jqDoubleArgFlags.has(arg)) {
                i += 3; // skip flag, name, and value
                continue;
            }
            // Flags that consume one argument
            if (jqArgFlags.has(arg)) {
                i += 2;
                continue;
            }
            // --tab (no argument)
            if (arg === '--tab') {
                i++;
                continue;
            }
            // Other flags
            if (arg.startsWith('-')) {
                i++;
                continue;
            }
            // First positional arg is the filter expression
            if (!filterConsumed) {
                filterConsumed = true;
                i++;
                continue;
            }
            // Remaining positional args are file paths
            paths.push(arg);
            i++;
        }
        return paths;
    },
};
// ============================================================================
// 6. COMMAND_OPERATION_TYPE
// ============================================================================
/**
 * Map each known command to its file operation type.
 *
 * - read: command only reads files/directories
 * - create: command creates new files/directories
 * - write: command modifies or deletes files
 */
export const COMMAND_OPERATION_TYPE = {
    cd: 'read',
    ls: 'read',
    find: 'read',
    cat: 'read',
    head: 'read',
    tail: 'read',
    sort: 'read',
    uniq: 'read',
    wc: 'read',
    cut: 'read',
    paste: 'read',
    column: 'read',
    tr: 'read',
    file: 'read',
    stat: 'read',
    diff: 'read',
    awk: 'read',
    strings: 'read',
    hexdump: 'read',
    od: 'read',
    base64: 'read',
    nl: 'read',
    grep: 'read',
    rg: 'read',
    git: 'read',
    jq: 'read',
    sha256sum: 'read',
    sha1sum: 'read',
    md5sum: 'read',
    mkdir: 'create',
    touch: 'create',
    rm: 'write',
    rmdir: 'write',
    mv: 'write',
    cp: 'write',
    sed: 'write',
};
// ============================================================================
// 7. DANGEROUS_REMOVAL_PATHS
// ============================================================================
/**
 * System directories that rm/rmdir should NEVER auto-allow removal of.
 * These are critical system paths whose removal could brick the system.
 */
export const DANGEROUS_REMOVAL_PATHS = new Set([
    '/',
    '/tmp',
    '/etc',
    '/var',
    '/home',
    '/root',
    '/usr',
    '/bin',
    '/sbin',
    '/lib',
    '/sys',
    '/proc',
    '/dev',
    '/boot',
]);
// ============================================================================
// 8. isDangerousRemovalPath
// ============================================================================
/**
 * Check if an absolute path is dangerous to remove.
 *
 * A path is dangerous if:
 * - It is in the DANGEROUS_REMOVAL_PATHS set, OR
 * - It is a 1-level child of `/` (like `/opt`, `/srv`, `/mnt`)
 *
 * @param absolutePath - The absolute path to check (must be already resolved)
 * @returns true if the path should never be auto-allowed for removal
 */
export function isDangerousRemovalPath(absolutePath) {
    // Normalize trailing slashes for comparison
    const normalized = absolutePath.replace(/\/+$/, '') || '/';
    if (DANGEROUS_REMOVAL_PATHS.has(normalized)) {
        return true;
    }
    // Check if it's a 1-level child of / (e.g. /opt, /mnt, /srv)
    // These are paths like /something with no further nesting
    if (/^\/[^/]+$/.test(normalized)) {
        return true;
    }
    return false;
}
// ============================================================================
// 9. checkDangerousRemovalPaths
// ============================================================================
/**
 * For rm/rmdir commands, check if any target paths are dangerous system directories.
 *
 * Extracts paths from the command args, expands tildes, resolves to absolute,
 * and checks each against isDangerousRemovalPath.
 *
 * @param command - The PathCommand (should be 'rm' or 'rmdir')
 * @param args - Tokenized arguments (command name already removed)
 * @param cwd - Current working directory for resolving relative paths
 * @returns 'ask' if a dangerous path is found, 'passthrough' otherwise
 */
export function checkDangerousRemovalPaths(command, args, cwd) {
    if (command !== 'rm' && command !== 'rmdir') {
        return passthrough('Not a removal command');
    }
    const extractor = PATH_EXTRACTORS[command];
    const rawPaths = extractor(args);
    for (const rawPath of rawPaths) {
        const expanded = expandTilde(rawPath);
        const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
        if (isDangerousRemovalPath(absolute)) {
            return ask(`Refusing to auto-allow removal of system directory "${absolute}". ` +
                `This path is protected because removing it could damage the system.`);
        }
    }
    return passthrough('No dangerous removal paths detected');
}
// ============================================================================
// 10. expandTilde
// ============================================================================
/**
 * Replace a leading `~/` or standalone `~` with the user's home directory.
 *
 * @param p - A file path that may begin with `~`
 * @returns The expanded path
 */
export function expandTilde(p) {
    if (p === '~') {
        return homedir();
    }
    if (p.startsWith('~/')) {
        return homedir() + p.slice(1);
    }
    return p;
}
// ============================================================================
// 11. validateCommandPaths
// ============================================================================
/**
 * Validate that all file paths referenced by a command are within the
 * allowed working directories.
 *
 * @param command - The recognized PathCommand
 * @param args - Tokenized arguments (command name already removed)
 * @param cwd - Current working directory
 * @param workingDirectories - List of allowed working directories
 * @param operationTypeOverride - Override the default operation type for the command
 * @returns 'passthrough' if all paths are valid, 'ask' with details otherwise
 */
export function validateCommandPaths(command, args, cwd, workingDirectories, operationTypeOverride) {
    const extractor = PATH_EXTRACTORS[command];
    const rawPaths = extractor(args);
    const operationType = operationTypeOverride ?? COMMAND_OPERATION_TYPE[command];
    for (const rawPath of rawPaths) {
        const expanded = expandTilde(rawPath);
        const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
        const isInWorkingDir = workingDirectories.some(wd => pathInWorkingPath(absolute, wd));
        if (!isInWorkingDir) {
            if (operationType === 'write' || operationType === 'create') {
                return ask(`Command "${command}" wants to ${operationType} "${absolute}" which is outside ` +
                    `the allowed working directories. Approve?`);
            }
            // Read operations outside working dirs also need approval
            return ask(`Command "${command}" wants to read "${absolute}" which is outside ` +
                `the allowed working directories. Approve?`);
        }
    }
    return passthrough('All paths are within allowed working directories');
}
// ============================================================================
// Internal: tokenize arguments (quote-aware whitespace split)
// ============================================================================
/**
 * Simple shell-like tokenizer: splits a string on whitespace while respecting
 * single and double quotes. Does NOT handle backslash escaping outside quotes
 * (that level of fidelity is handled by the security validators).
 *
 * @param str - The string to tokenize
 * @returns Array of tokens
 */
function tokenizeArgs(str) {
    const tokens = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (inSingleQuote) {
            if (ch === "'") {
                inSingleQuote = false;
            }
            else {
                current += ch;
            }
            i++;
            continue;
        }
        if (inDoubleQuote) {
            if (ch === '"') {
                inDoubleQuote = false;
            }
            else if (ch === '\\' && i + 1 < str.length) {
                const next = str[i + 1];
                if (next === '"' || next === '\\' || next === '$' || next === '`') {
                    current += next;
                    i++;
                }
                else {
                    current += ch;
                }
            }
            else {
                current += ch;
            }
            i++;
            continue;
        }
        // Outside quotes
        if (ch === "'") {
            inSingleQuote = true;
            i++;
            continue;
        }
        if (ch === '"') {
            inDoubleQuote = true;
            i++;
            continue;
        }
        if (ch === '\\' && i + 1 < str.length) {
            current += str[i + 1];
            i += 2;
            continue;
        }
        if (ch === ' ' || ch === '\t') {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            i++;
            continue;
        }
        current += ch;
        i++;
    }
    if (current.length > 0) {
        tokens.push(current);
    }
    return tokens;
}
// ============================================================================
// Internal: extract base command from a subcommand string
// ============================================================================
/**
 * Extract the base command name from a subcommand string.
 *
 * Handles:
 * - Leading environment variables (KEY=VALUE cmd)
 * - Common path prefixes (/usr/bin/cmd → cmd)
 * - sudo / env / nohup prefixes
 *
 * @param subcommand - A single (sub)command string
 * @returns The base command name
 */
function extractBaseCommand(subcommand) {
    const tokens = tokenizeArgs(subcommand.trim());
    let idx = 0;
    // Skip leading env-var assignments (KEY=VALUE)
    while (idx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[idx])) {
        idx++;
    }
    // Skip command wrappers
    while (idx < tokens.length) {
        const tok = tokens[idx];
        if (tok === 'sudo' || tok === 'env' || tok === 'nohup' || tok === 'nice' || tok === 'time' || tok === 'command') {
            idx++;
            // Skip flags after the wrapper (e.g. sudo -u root)
            while (idx < tokens.length && tokens[idx].startsWith('-')) {
                idx++;
            }
            continue;
        }
        break;
    }
    if (idx >= tokens.length)
        return '';
    const cmd = tokens[idx];
    // Strip path prefix: /usr/bin/grep → grep
    const slashIdx = cmd.lastIndexOf('/');
    return slashIdx >= 0 ? cmd.slice(slashIdx + 1) : cmd;
}
// ============================================================================
// Internal: extract output redirection targets
// ============================================================================
/**
 * Extract file paths that are targets of output redirections (> and >>).
 *
 * Scans through the command text character by character, respecting quotes,
 * and collects the target of each `>` or `>>` operator.
 *
 * @param command - The full command string
 * @returns Array of output redirection target paths
 */
function extractRedirectionTargets(command) {
    const targets = [];
    let i = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    while (i < command.length) {
        const ch = command[i];
        // Quote tracking
        if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            i++;
            continue;
        }
        if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            i++;
            continue;
        }
        if (inSingleQuote || inDoubleQuote) {
            i++;
            continue;
        }
        // Backslash escape
        if (ch === '\\' && i + 1 < command.length) {
            i += 2;
            continue;
        }
        // Check for > or >> (but not process substitution >())
        if (ch === '>') {
            // Skip stderr-to-stdout (2>&1)
            if (i > 0 && command[i - 1] === '&') {
                i++;
                continue;
            }
            // Check for >&N (fd duplication)
            if (i + 1 < command.length && command[i + 1] === '&') {
                i += 2;
                continue;
            }
            // Check for >() process substitution
            if (i + 1 < command.length && command[i + 1] === '(') {
                i++;
                continue;
            }
            // Advance past >> or >
            let redirEnd = i + 1;
            if (redirEnd < command.length && command[redirEnd] === '>') {
                redirEnd++;
            }
            // Skip whitespace after the operator
            while (redirEnd < command.length && (command[redirEnd] === ' ' || command[redirEnd] === '\t')) {
                redirEnd++;
            }
            // Collect the target path (respecting quotes)
            let target = '';
            let tInSQ = false;
            let tInDQ = false;
            while (redirEnd < command.length) {
                const tc = command[redirEnd];
                if (tc === "'" && !tInDQ) {
                    tInSQ = !tInSQ;
                    redirEnd++;
                    continue;
                }
                if (tc === '"' && !tInSQ) {
                    tInDQ = !tInDQ;
                    redirEnd++;
                    continue;
                }
                if (!tInSQ && !tInDQ && (tc === ' ' || tc === '\t' || tc === ';' || tc === '&' || tc === '|' || tc === '\n')) {
                    break;
                }
                if (tc === '\\' && !tInSQ && redirEnd + 1 < command.length) {
                    target += command[redirEnd + 1];
                    redirEnd += 2;
                    continue;
                }
                target += tc;
                redirEnd++;
            }
            if (target.length > 0) {
                targets.push(target);
            }
            i = redirEnd;
            continue;
        }
        i++;
    }
    return targets;
}
// ============================================================================
// Set of all known PathCommand names for fast lookup
// ============================================================================
const KNOWN_PATH_COMMANDS = new Set(Object.keys(PATH_EXTRACTORS));
/**
 * Type guard: check if a string is a known PathCommand.
 */
function isPathCommand(cmd) {
    return KNOWN_PATH_COMMANDS.has(cmd);
}
// ============================================================================
// 12. checkPathConstraints
// ============================================================================
/**
 * Main entry point: validate all file paths referenced by a bash command.
 *
 * Splits the command into subcommands (by shell operators), extracts the
 * base command of each, and validates paths using the appropriate extractor.
 *
 * Also validates output redirection targets (>, >>).
 *
 * @param input - Object containing the command string
 * @param cwd - Current working directory
 * @param workingDirectories - List of allowed working directories
 * @param toolPermissionContext - Permission context (unused currently, reserved)
 * @returns 'passthrough' if all paths are valid, 'ask' if any path is blocked
 */
export function checkPathConstraints(input, cwd, workingDirectories, toolPermissionContext) {
    // If no working directories are configured, skip path validation
    if (workingDirectories.length === 0) {
        return passthrough('No working directories configured; skipping path validation');
    }
    const subcommands = splitCommand(input.command);
    for (const sub of subcommands) {
        const baseCommand = extractBaseCommand(sub);
        if (!isPathCommand(baseCommand)) {
            continue;
        }
        // Tokenize the arguments (everything after the base command)
        const trimmed = sub.trim();
        const tokens = tokenizeArgs(trimmed);
        // Find the index of the base command in tokens to extract args after it
        let cmdIdx = 0;
        // Skip env-var assignments and wrappers (same logic as extractBaseCommand)
        while (cmdIdx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[cmdIdx])) {
            cmdIdx++;
        }
        while (cmdIdx < tokens.length) {
            const tok = tokens[cmdIdx];
            if (tok === 'sudo' || tok === 'env' || tok === 'nohup' || tok === 'nice' || tok === 'time' || tok === 'command') {
                cmdIdx++;
                while (cmdIdx < tokens.length && tokens[cmdIdx].startsWith('-')) {
                    cmdIdx++;
                }
                continue;
            }
            break;
        }
        // cmdIdx now points to the base command token; args start at cmdIdx + 1
        const args = tokens.slice(cmdIdx + 1);
        // For rm/rmdir, check dangerous removal paths first
        if (baseCommand === 'rm' || baseCommand === 'rmdir') {
            const dangerousResult = checkDangerousRemovalPaths(baseCommand, args, cwd);
            if (dangerousResult.behavior === 'ask') {
                return dangerousResult;
            }
        }
        // Validate paths are within working directories
        const pathResult = validateCommandPaths(baseCommand, args, cwd, workingDirectories);
        if (pathResult.behavior === 'ask') {
            return pathResult;
        }
    }
    // Check output redirections across the entire command
    const redirectionTargets = extractRedirectionTargets(input.command);
    for (const target of redirectionTargets) {
        const expanded = expandTilde(target);
        const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
        const isInWorkingDir = workingDirectories.some(wd => pathInWorkingPath(absolute, wd));
        if (!isInWorkingDir) {
            return ask(`Output redirection target "${absolute}" is outside the allowed working directories. Approve?`);
        }
    }
    return passthrough('All command paths are within allowed working directories');
}
// ============================================================================
// Exports
// ============================================================================
export { tokenizeArgs as _tokenizeArgs, extractBaseCommand as _extractBaseCommand, extractRedirectionTargets as _extractRedirectionTargets, isPathCommand as _isPathCommand, };
//# sourceMappingURL=pathValidation.js.map