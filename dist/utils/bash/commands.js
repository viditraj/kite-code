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
// ============================================================================
// Shell control operators recognized by the splitter
// ============================================================================
/** Multi-character operators that act as command separators. Order matters:
 *  longer operators must be checked before shorter ones to avoid partial matches. */
const MULTI_CHAR_OPERATORS = ['&&', '||'];
/** Single-character operators that act as command separators or pipe/background. */
const SINGLE_CHAR_OPERATORS = ['|', ';', '&'];
/** All control operators as a flat set for fast lookup. */
const ALL_CONTROL_OPERATORS = new Set([
    ...MULTI_CHAR_OPERATORS,
    ...SINGLE_CHAR_OPERATORS,
]);
/**
 * Create a fresh scan state.
 */
function freshState() {
    return {
        inSingleQuote: false,
        inDoubleQuote: false,
        escaped: false,
        parenDepth: 0,
        backtickDepth: 0,
    };
}
/**
 * Advance the scan state by one character. Returns the number of characters
 * consumed (usually 1, but may be 2 for `&&` / `||` when an operator match
 * is found at the top level).
 *
 * When an operator is found at the top level, `onOperator` is called with the
 * operator string and the index at which it starts. The caller decides what to
 * do (e.g. push a boundary).
 */
function advance(command, i, state, onOperator) {
    const ch = command[i];
    // ---- backslash escape (not inside single quotes) ----
    if (state.escaped) {
        state.escaped = false;
        return 1;
    }
    if (ch === '\\' && !state.inSingleQuote) {
        state.escaped = true;
        return 1;
    }
    // ---- single quotes (toggle; no escaping inside) ----
    if (ch === "'" && !state.inDoubleQuote) {
        state.inSingleQuote = !state.inSingleQuote;
        return 1;
    }
    // ---- double quotes (toggle; backslash escaping handled above) ----
    if (ch === '"' && !state.inSingleQuote) {
        state.inDoubleQuote = !state.inDoubleQuote;
        return 1;
    }
    // Inside any quoting context, just consume the character literally.
    if (state.inSingleQuote || state.inDoubleQuote) {
        return 1;
    }
    // ---- parentheses nesting (outside quotes) ----
    if (ch === '(') {
        state.parenDepth++;
        return 1;
    }
    if (ch === ')') {
        if (state.parenDepth > 0)
            state.parenDepth--;
        return 1;
    }
    // ---- backtick nesting (outside quotes) ----
    if (ch === '`') {
        // Toggle: odd depth means we are inside, even means outside.
        if (state.backtickDepth > 0) {
            state.backtickDepth--;
        }
        else {
            state.backtickDepth++;
        }
        return 1;
    }
    // ---- operator detection (only at the top level) ----
    if (state.parenDepth === 0 && state.backtickDepth === 0 && onOperator) {
        // Try multi-char operators first (&&, ||)
        for (const op of MULTI_CHAR_OPERATORS) {
            if (command.startsWith(op, i)) {
                onOperator(op, i);
                return op.length;
            }
        }
        // Then single-char operators (|, ;, &)
        for (const op of SINGLE_CHAR_OPERATORS) {
            if (ch === op) {
                onOperator(op, i);
                return 1;
            }
        }
    }
    return 1;
}
// ============================================================================
// Public API
// ============================================================================
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
export function splitCommand(command) {
    return filterControlOperators(splitCommandWithOperators(command));
}
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
export function filterControlOperators(parts) {
    return parts.filter(part => !ALL_CONTROL_OPERATORS.has(part));
}
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
export function isHelpCommand(command) {
    const trimmed = command.trim();
    // Must end with --help
    if (!trimmed.endsWith('--help')) {
        return false;
    }
    // Reject commands with quotes — they might bypass restrictions
    if (trimmed.includes('"') || trimmed.includes("'")) {
        return false;
    }
    // Tokenize by whitespace (safe since we rejected quotes above)
    const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
    // Must have at least 2 tokens: a command and --help
    if (tokens.length < 2) {
        return false;
    }
    const alphanumericPattern = /^[a-zA-Z0-9]+$/;
    let foundHelp = false;
    for (const token of tokens) {
        if (token.startsWith('-')) {
            // Only --help is allowed as a flag
            if (token === '--help') {
                foundHelp = true;
            }
            else {
                return false;
            }
        }
        else {
            // Non-flag tokens must be purely alphanumeric
            if (!alphanumericPattern.test(token)) {
                return false;
            }
        }
    }
    return foundHelp;
}
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
export function splitCommandWithOperators(command) {
    const result = [];
    const state = freshState();
    let segmentStart = 0;
    /**
     * Called each time an operator is found at the top level. Pushes the
     * preceding command segment (if non-empty) and the operator itself.
     */
    function onOperator(op, idx) {
        const segment = command.slice(segmentStart, idx).trim();
        if (segment.length > 0) {
            result.push(segment);
        }
        result.push(op);
        segmentStart = idx + op.length;
    }
    let i = 0;
    while (i < command.length) {
        const consumed = advance(command, i, state, onOperator);
        // If an operator was found, segmentStart was already moved forward
        // by onOperator. `consumed` accounts for the operator length, so
        // we just advance `i`.
        i += consumed;
    }
    // Push trailing segment after last operator (if any)
    const tail = command.slice(segmentStart).trim();
    if (tail.length > 0) {
        result.push(tail);
    }
    return result;
}
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
export function stripOutputRedirections(command) {
    return (command
        // Strip stderr-to-stdout: 2>&1
        .replace(/\s+2\s*>&\s*1(?=\s|$)/g, '')
        // Strip FD-prefixed file redirections: [0|1|2]?  >|>>  target
        .replace(/\s+[012]?\s*>>?\s+\S+/g, '')
        .trim());
}
//# sourceMappingURL=commands.js.map