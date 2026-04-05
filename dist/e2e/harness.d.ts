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
import { type ChildProcess } from 'node:child_process';
export interface KiteProcessOptions {
    /** CLI arguments (e.g., ['--help']) */
    args?: string[];
    /** Environment variables (merged with process.env) */
    env?: Record<string, string>;
    /** Working directory */
    cwd?: string;
    /** Timeout in ms before force-killing (default: 10_000) */
    timeout?: number;
    /** If true, allocate a pseudo-TTY (simulates interactive mode) */
    tty?: boolean;
}
export interface KiteProcess {
    /** The underlying child process */
    proc: ChildProcess;
    /** All stdout output collected so far */
    stdout: string;
    /** All stderr output collected so far */
    stderr: string;
    /** Write text to stdin */
    write(text: string): void;
    /** Write text followed by Enter */
    writeLine(text: string): void;
    /** Wait for stdout to contain the given string (or regex) */
    waitForOutput(pattern: string | RegExp, timeoutMs?: number): Promise<string>;
    /** Wait for stderr to contain the given string (or regex) */
    waitForError(pattern: string | RegExp, timeoutMs?: number): Promise<string>;
    /** Wait for the process to exit, return { code, stdout, stderr } */
    waitForExit(timeoutMs?: number): Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
    }>;
    /** Send SIGTERM and wait for exit */
    kill(): Promise<void>;
}
/**
 * Spawn a Kite CLI process with the given options.
 */
export declare function spawnKite(options?: KiteProcessOptions): KiteProcess;
//# sourceMappingURL=harness.d.ts.map