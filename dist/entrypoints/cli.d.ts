#!/usr/bin/env node
/**
 * Kite CLI entrypoint.
 *
 * Ported from: Claude Code's src/entrypoints/cli.tsx + src/main.tsx.
 *
 * Boot sequence:
 * 1. Parse --version, --help (instant exit via Commander)
 * 2. Load kite.config.json + ~/.kite/config.json (global config)
 * 3. First-run: show onboarding walkthrough (theme → provider → security)
 * 4. Explicit --setup: show provider setup wizard
 * 5. Resolve LLM provider
 * 6. Handle --continue / --resume (session picker if no ID given)
 * 7. If --print / -p: non-interactive mode (print and exit)
 * 8. Otherwise: launch interactive Ink REPL
 */
export {};
//# sourceMappingURL=cli.d.ts.map