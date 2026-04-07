# AGENTS.md — Kite TypeScript Project Guide

## ABSOLUTE RULES

1. **NEVER create placeholder code.** Every function must be fully implemented. No `// TODO`, no `throw new Error('not implemented')`, no stubs. If a function is written, it works completely.

2. **Every file must be production-ready.** No partial implementations.

3. **Always read the Claude Code source** (`/root/claude-code/src/`) before writing Kite code. Understand the original logic, then implement the equivalent.

4. **Test everything.** Every module gets tests before moving to the next.

## Project Structure

Kite is a 1:1 reimplementation of Claude Code in TypeScript, targeting Node.js 20+.

- Source: `/root/claude-code/src/` (reference)
- Target: `/root/kite-ts/` (implementation)
- Plan: `/root/kite-ts/IMPLEMENTATION_PLAN.md`
- Architecture: `/root/kite-ts/ARCHITECTURE.md`

## What's Different From Claude Code

- Multi-provider LLM support (not Anthropic-only)
- Zero telemetry (no GrowthBook, no Datadog, no analytics)
- Zero OAuth (API keys via env vars)
- Local config (`kite.config.json` replaces GrowthBook remote flags)
- Node.js 20+ (not Bun-dependent)

## Build & Test

```bash
cd /root/kite-ts
npm install
npm run build       # TypeScript → dist/
npm test            # 692 tests, 32 test files
npm start -- --help # Run from source via tsx
```

## Current State

- **135 source files**, **34 test files**, **38,736 source lines**
- **35+ tools**, **50 commands**, **14 hooks**, **65+ components**
- **772 tests passing**, **0 TypeScript errors**
- **6 themes**, **8 LLM providers**
- **Headless pipeline engine** with YAML config, cron scheduling, and JSONL logging

### Key Modules

| Module | Path | Description |
|--------|------|-------------|
| CLI entry | `src/entrypoints/cli.ts` | Boot sequence, arg parsing, onboarding, pipeline subcommands |
| Daemon | `src/entrypoints/daemon.ts` | Pipeline scheduler daemon |
| REPL | `src/screens/REPL.tsx` | Ink-based interactive terminal UI |
| Query loop | `src/query.ts` | Async generator with streaming + tool execution |
| QueryEngine | `src/QueryEngine.ts` | Orchestrates conversations |
| Commands | `src/commands.ts` | 50 slash commands |
| Tools | `src/tools/` | 35+ tool implementations |
| HttpRequest | `src/tools/HttpRequestTool/` | Full HTTP client (all methods, headers, auth, body) |
| Pipeline | `src/services/pipeline/` | Headless pipeline engine (loader, executor, scheduler, logger) |
| PipelineTool | `src/tools/PipelineTool/` | 5 agent-facing pipeline tools |
| Providers | `src/providers/` | Anthropic + OpenAI-compatible adapters |
| Hooks | `src/ink/hooks/` | 14 React hooks |
| State | `src/state/` | AppStateStore + persistence + React context |
| Plugins | `src/plugins/pluginLoader.ts` | Plugin manifest + ESM loading |
| Skills | `src/skills/loadSkillsDir.ts` | SKILL.md parsing + registration |
| Session | `src/utils/session.ts` | JSONL session persistence |
| File history | `src/utils/fileHistory.ts` | Snapshot backup/restore |
| Bash security | `src/tools/BashTool/` | 6 validation layers |
| Autocomplete | `src/utils/suggestions/` | Command fuzzy matching |
| MCP | `src/services/mcp/` | MCP server management |
| Compaction | `src/services/compact/` | Auto-compact + microcompact |

## Browser Integration

Kite has built-in browser access via the Playwright MCP server (`@playwright/mcp`).
This is auto-registered as an MCP server at startup — no user configuration needed.

### How it works

- `src/services/browser/config.ts` provides the built-in Playwright MCP server config
- `src/services/mcp/config.ts` merges it at the lowest priority (user configs can override)
- The server runs `playwright-mcp --headless --caps vision` via stdio transport
- Screenshots are returned as base64 images through `ContentBlock[]` (vision support)
- 27 browser tools are available: navigate, screenshot, click, type, snapshot, etc.

### Available browser tools

Key tools (prefixed with `mcp__playwright__` when registered):
- `browser_navigate` — go to a URL
- `browser_take_screenshot` — capture page screenshot (returns image)
- `browser_click` — click an element by accessibility ref
- `browser_type` — type text into input fields
- `browser_snapshot` — get the page accessibility tree
- `browser_close` — close the browser
- `browser_evaluate` — run JavaScript in the browser
- `browser_fill_form` — fill form fields
- `browser_press_key` — press keyboard keys
- `browser_tabs` — list open tabs
- `browser_wait_for` — wait for an element

### Customizing

Users can override the built-in config by adding a `playwright` entry to their
MCP config (`.mcp.json`, `kite.config.json`, or `~/.kite/config.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp", "--headless", "--browser", "firefox"]
    }
  }
}
```

To disable the browser entirely:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "echo",
      "disabled": true
    }
  }
}
```
