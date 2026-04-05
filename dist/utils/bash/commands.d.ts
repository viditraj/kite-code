/**
 * Bash command splitting and shell utility module.
 *
 * Pure TypeScript implementation — no external dependencies (no shell-quote).
 * All parsing is done with string manipulation and state machines.
 *
 * Exports:
 * - splitCommand: split compound shell commands into individual commands
 * - filterControlOperators: remove shell operators from token arrays
 * - isHelpCommand: detect simple `--help` invocations
 * - splitCommandWithOperators: split preserving operators as elements
 * - stripOutputRedirections: remove output redirections from command text
 */
/**
 * Split a compound shell command string by control operators (`&&`, `||`,
 * `|`, `;`, `&`), returning only the individual command strings with
 * operators filtered out.
 *
 * Handles:
 * - Single-quote tracking (no escaping inside `'...'`)
 * - Double-quote tracking (backslash escaping inside `"..."`)
 * - Backslash escaping outside quotes
 * - Nested parentheses `(...)` — operators inside are not split
 * - Backtick nesting `` `...` `` — operators inside are not split
 *
 * @param command - The compound shell command string
 * @returns Array of individual command strings (operators removed, trimmed)
 *
 * @example
 * ```ts
 * splitCommand('echo hello && ls -la')
 * // => ['echo hello', 'ls -la']
 *
 * splitCommand('echo "a && b" | grep a')
 * // => ['echo "a && b"', 'grep a']
 * ```
 */
export declare function splitCommand(command: string): string[];
/**
 * Filter out shell control operators from an array of tokens, keeping only
 * non-operator command strings.
 *
 * Recognized operators: `&&`, `||`, `|`, `;`, `&`
 *
 * @param parts - Array of strings that may include operator tokens
 * @returns Array with operator-only elements removed
 *
 * @example
 * ```ts
 * filterControlOperators(['echo hi', '&&', 'ls', '|', 'grep x'])
 * // => ['echo hi', 'ls', 'grep x']
 * ```
 */
export declare function filterControlOperators(parts: string[]): string[];
/**
 * Check if a command is a simple help invocation (e.g. `foo --help` or
 * `foo bar --help`).
 *
 * Returns `true` when ALL of:
 * 1. The command ends with `--help`
 * 2. The command contains no other flags (tokens starting with `-`)
 * 3. The command contains no quotes (`'` or `"`)
 * 4. All non-flag tokens are purely alphanumeric (`/^[a-zA-Z0-9]+$/`)
 *
 * This allows safe auto-approval of help commands without broader prefix
 * matching.
 *
 * @param command - The shell command string to check
 * @returns `true` if it matches the help-command pattern
 *
 * @example
 * ```ts
 * isHelpCommand('python --help')    // true
 * isHelpCommand('git commit --help') // true
 * isHelpCommand('git --verbose --help') // false (extra flag)
 * isHelpCommand('cat "file" --help') // false (quotes)
 * ```
 */
export declare function isHelpCommand(command: string): boolean;
/**
 * Split a compound shell command by control operators, preserving the
 * operators as separate array elements.
 *
 * The returned array alternates between command strings and operator strings.
 * Empty segments (e.g. from leading/trailing operators) are omitted.
 *
 * Handles all quoting and nesting contexts identically to {@link splitCommand}.
 *
 * @param command - The compound shell command string
 * @returns Array of command strings and operator strings interleaved
 *
 * @example
 * ```ts
 * splitCommandWithOperators('echo hi && ls | grep x')
 * // => ['echo hi', '&&', 'ls', '|', 'grep x']
 *
 * splitCommandWithOperators('echo "a;b" ; pwd')
 * // => ['echo "a;b"', ';', 'pwd']
 * ```
 */
export declare function splitCommandWithOperators(command: string): string[];
/**
 * Strip common output redirections from a command string, returning the
 * command without them. This is used to clean up commands for display in
 * permission prompts so that redirection targets are not confused with
 * command arguments.
 *
 * Handles:
 * - `2>&1` (stderr to stdout)
 * - File redirections: `> file`, `>> file`, `2> file`, `1>> file`
 * - FD-prefixed redirections with optional file descriptor 0, 1, or 2
 *
 * Uses regex patterns:
 * - `/\s+2\s*>&\s*1(?=\s|$)/g` for stderr-to-stdout
 * - `/\s+[012]?\s*>>?\s+\S+/g` for file redirections (simple form)
 *
 * **Security note:** All patterns use trailing boundaries (`(?=\s|$)` or
 * `\S+` greediness) to avoid prefix-matching attacks (e.g. `> /dev/nullo`
 * must NOT strip as `> /dev/null`).
 *
 * @param command - The shell command string
 * @returns The command with output redirections removed
 *
 * @example
 * ```ts
 * stripOutputRedirections('echo hello 2>&1')
 * // => 'echo hello'
 *
 * stripOutputRedirections('make build > /tmp/out.log 2>&1')
 * // => 'make build'
 *
 * stripOutputRedirections('cmd 2>> errors.log')
 * // => 'cmd'
 * ```
 */
export declare function stripOutputRedirections(command: string): string;
//# sourceMappingURL=commands.d.ts.map