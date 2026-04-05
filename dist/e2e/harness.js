/**
 * E2E Test Harness for Kite CLI.
 *
 * Spawns the CLI as a child process and provides helpers to:
 * - Send input to stdin
 * - Wait for specific output patterns on stdout/stderr
 * - Assert exit codes
 * - Clean up on timeout
 *
 * Uses the built dist/ for speed. Falls back to tsx if dist doesn't exist.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const BUILT_CLI = resolve(PROJECT_ROOT, 'dist/entrypoints/cli.js');
const SRC_CLI = resolve(PROJECT_ROOT, 'src/entrypoints/cli.ts');
/**
 * Spawn a Kite CLI process with the given options.
 */
export function spawnKite(options = {}) {
    const { args = [], env = {}, cwd = PROJECT_ROOT, timeout = 10_000 } = options;
    // Determine the command to use
    let command;
    let spawnArgs;
    if (existsSync(BUILT_CLI)) {
        command = process.execPath;
        spawnArgs = ['--no-warnings', BUILT_CLI, ...args];
    }
    else {
        command = process.execPath;
        spawnArgs = ['--no-warnings', '--import', 'tsx/esm', SRC_CLI, ...args];
    }
    const proc = spawn(command, spawnArgs, {
        cwd,
        env: {
            ...process.env,
            NODE_NO_WARNINGS: '1',
            // Disable telemetry/analytics env vars
            KITE_TELEMETRY: '0',
            // Force non-interactive for most tests
            ...(options.tty ? {} : { TERM: 'dumb' }),
            ...env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdoutBuf = '';
    let stderrBuf = '';
    let exited = false;
    let exitCode = null;
    const stdoutWaiters = [];
    const stderrWaiters = [];
    const exitWaiters = [];
    proc.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdoutBuf += text;
        // Check waiters
        for (let i = stdoutWaiters.length - 1; i >= 0; i--) {
            const w = stdoutWaiters[i];
            const match = typeof w.pattern === 'string' ? stdoutBuf.includes(w.pattern) : w.pattern.test(stdoutBuf);
            if (match) {
                stdoutWaiters.splice(i, 1);
                w.resolve(stdoutBuf);
            }
        }
    });
    proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuf += text;
        for (let i = stderrWaiters.length - 1; i >= 0; i--) {
            const w = stderrWaiters[i];
            const match = typeof w.pattern === 'string' ? stderrBuf.includes(w.pattern) : w.pattern.test(stderrBuf);
            if (match) {
                stderrWaiters.splice(i, 1);
                w.resolve(stderrBuf);
            }
        }
    });
    proc.on('exit', (code) => {
        exited = true;
        exitCode = code;
        // Reject any remaining stdout/stderr waiters
        for (const w of stdoutWaiters) {
            w.reject(new Error(`Process exited (code ${code}) before stdout matched. stdout:\n${stdoutBuf}`));
        }
        stdoutWaiters.length = 0;
        for (const w of stderrWaiters) {
            w.reject(new Error(`Process exited (code ${code}) before stderr matched. stderr:\n${stderrBuf}`));
        }
        stderrWaiters.length = 0;
        // Resolve exit waiters
        for (const w of exitWaiters) {
            w.resolve({ code, stdout: stdoutBuf, stderr: stderrBuf });
        }
        exitWaiters.length = 0;
    });
    // Global timeout: kill process if it hasn't exited
    const killTimer = setTimeout(() => {
        if (!exited) {
            proc.kill('SIGKILL');
        }
    }, timeout);
    proc.on('exit', () => clearTimeout(killTimer));
    const handle = {
        proc,
        get stdout() { return stdoutBuf; },
        get stderr() { return stderrBuf; },
        write(text) {
            proc.stdin.write(text);
        },
        writeLine(text) {
            proc.stdin.write(text + '\n');
        },
        waitForOutput(pattern, timeoutMs = 5000) {
            // Check if already matched
            const match = typeof pattern === 'string' ? stdoutBuf.includes(pattern) : pattern.test(stdoutBuf);
            if (match)
                return Promise.resolve(stdoutBuf);
            if (exited)
                return Promise.reject(new Error(`Process already exited. stdout:\n${stdoutBuf}`));
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const idx = stdoutWaiters.findIndex(w => w.resolve === resolve);
                    if (idx >= 0)
                        stdoutWaiters.splice(idx, 1);
                    reject(new Error(`Timed out waiting for stdout pattern "${pattern}" after ${timeoutMs}ms. stdout:\n${stdoutBuf}`));
                }, timeoutMs);
                stdoutWaiters.push({
                    pattern,
                    resolve: (s) => { clearTimeout(timer); resolve(s); },
                    reject: (e) => { clearTimeout(timer); reject(e); },
                });
            });
        },
        waitForError(pattern, timeoutMs = 5000) {
            const match = typeof pattern === 'string' ? stderrBuf.includes(pattern) : pattern.test(stderrBuf);
            if (match)
                return Promise.resolve(stderrBuf);
            if (exited)
                return Promise.reject(new Error(`Process already exited. stderr:\n${stderrBuf}`));
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const idx = stderrWaiters.findIndex(w => w.resolve === resolve);
                    if (idx >= 0)
                        stderrWaiters.splice(idx, 1);
                    reject(new Error(`Timed out waiting for stderr pattern "${pattern}" after ${timeoutMs}ms. stderr:\n${stderrBuf}`));
                }, timeoutMs);
                stderrWaiters.push({
                    pattern,
                    resolve: (s) => { clearTimeout(timer); resolve(s); },
                    reject: (e) => { clearTimeout(timer); reject(e); },
                });
            });
        },
        waitForExit(timeoutMs = 10_000) {
            if (exited)
                return Promise.resolve({ code: exitCode, stdout: stdoutBuf, stderr: stderrBuf });
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    proc.kill('SIGKILL');
                    reject(new Error(`Process did not exit within ${timeoutMs}ms. stdout:\n${stdoutBuf}\nstderr:\n${stderrBuf}`));
                }, timeoutMs);
                exitWaiters.push({
                    resolve: (r) => { clearTimeout(timer); resolve(r); },
                });
            });
        },
        async kill() {
            if (exited)
                return;
            proc.kill('SIGTERM');
            await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    if (!exited)
                        proc.kill('SIGKILL');
                    resolve();
                }, 2000);
                proc.on('exit', () => { clearTimeout(timer); resolve(); });
            });
        },
    };
    return handle;
}
//# sourceMappingURL=harness.js.map