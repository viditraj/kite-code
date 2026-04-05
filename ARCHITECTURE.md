# Architecture

This document describes the system design of Kite Code.

## Overview

Kite Code is a terminal-based AI coding assistant. It uses an **async generator query loop** to stream LLM responses, execute tools with permission gates, and recover from errors — all driven by a React-based terminal UI built on Ink.

```
┌──────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                        │
│  (cli.ts — arg parsing, config, onboarding, session resume)  │
└─────────────────────────┬────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │      REPL Screen      │
              │  (Ink React component) │
              │                       │
              │  ┌─────────────────┐  │
              │  │  PromptInput    │  │  ← user types here
              │  │  + Autocomplete │  │    (slash command suggestions)
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────▼────────┐  │
              │  │  QueryEngine    │  │  ← orchestrates conversations
              │  │  → query.ts     │  │    (async generator loop)
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────▼────────┐  │
              │  │   LLM Provider  │  │  ← Anthropic, OpenAI, Ollama, etc.
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────▼────────┐  │
              │  │  Tool Executor  │  │  ← permission check → execute
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────▼────────┐  │
              │  │  Message Display │  │  ← Static (scrollback) + Live area
              │  │  + StatusBar    │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

## Boot Sequence

1. **Parse CLI args** — Commander handles `--version`, `--help`, flags
2. **Load config** — `kite.config.json` (project) + `~/.kite/config.json` (global) + CLI overrides
3. **First-run onboarding** — theme picker → provider setup → security notes (only once)
4. **Create LLM provider** — factory dispatches to Anthropic or OpenAI-compatible adapter
5. **Session resume** — `--continue` loads most recent; `--resume` loads by ID or opens picker
6. **Bootstrap tools** — register all 29 built-in tools
7. **Connect MCP servers** — background connection to configured MCP servers (including built-in Playwright)
8. **Launch REPL** — Ink-based React app (or readline fallback for non-TTY)

## Query Loop (`query.ts`)

The core agent loop is an async generator that yields `QueryEvent` objects:

```
while (true) {
  1. Check max turns
  2. Auto-compact if near context limit
  3. Call the LLM (streaming)
  4. Accumulate text_delta, thinking_delta, tool_use events
  5. Handle stop reasons:
     - end_turn → return (conversation complete)
     - tool_use → execute tools with permission checks → continue
     - max_tokens → recovery (retry or reactive compact)
  6. Yield events for the REPL to render
}
```

Key design decisions:
- **Yields, doesn't return** — the REPL consumes events as they arrive for streaming display
- **Tool execution is gated** — each tool goes through `canUseTool()` which checks permissions, then the REPL shows an approval dialog if needed
- **Recovery is automatic** — max_tokens triggers up to 3 retry attempts with a continuation message; if that fails, reactive compaction kicks in

## Provider Abstraction

All providers implement `LLMProvider.chat()` returning `AsyncIterable<StreamEvent>`:

```typescript
interface LLMProvider {
  chat(params: ChatParams): AsyncIterable<StreamEvent>
}
```

Two adapters:
- **`anthropic.ts`** — native Anthropic Messages API with thinking support
- **`openai-compatible.ts`** — OpenAI chat completions API (works with OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or any compatible endpoint)

The factory (`factory.ts`) reads `config.provider.name` and dispatches.

## Tool System

Each tool is a `Tool` object with:
- `name`, `description`, `inputSchema` (Zod or JSON Schema)
- `isReadOnly` — determines default permission behavior
- `call(input, context)` → `ContentBlock[]`

Tools are registered in `bootstrap/tools.ts` and stored in the `QueryEngine`. The `StreamingToolExecutor` handles concurrent tool execution.

### Bash Security Stack

The Bash tool has 6 validation layers:
1. **bashSecurity** — 23 pattern checks (obfuscation, metacharacters, injection)
2. **bashPermissions** — rule matching with deny/ask/allow
3. **readOnlyValidation** — flag-based read-only detection for git, grep, etc.
4. **pathValidation** — dangerous path detection (system dirs, sensitive files)
5. **sedValidation** — sed command safety analysis
6. **modeValidation** — permission mode overrides

## UI Architecture

### Ink + React

The REPL is a React component tree rendered by Ink:

```
<REPL>
  <Static items={completedMessages}>     ← terminal scrollback (rendered once)
    <MessageRow />                        ← User/Assistant/System/ToolResult
  </Static>

  <LogoV2 />                             ← welcome screen (hidden after first input)

  {liveMessages.map(msg => ...)}          ← streaming response indicator

  <PermissionRequest />                   ← tool permission dialog
  <InteractiveList />                     ← command/model/theme pickers

  <Spinner />                             ← thinking/working indicator
  <PromptInput />                         ← input with autocomplete dropdown
  <StatusBar />                           ← model, branch, tokens, context %
</REPL>
```

### Static vs Live

- **Static area** — completed messages go into `<Static>`, which writes them to the terminal's native scrollback and never re-renders them. This gives us free scroll (mouse wheel, Shift+PgUp) with zero memory cost.
- **Live area** — the current streaming response, spinner, prompt, and status bar. Ink re-renders this region each frame (~16ms).

### Message Timestamps

Every message gets a `timestamp: number` (Unix ms). The `MessageTimestamp` component renders it as relative time ("just now", "2m ago", "1h ago") and auto-updates every 30 seconds via `useInterval`.

### Command Autocomplete

When the user types `/`, `PromptInput` activates the autocomplete system:
1. `findSlashCommandPrefix()` extracts the text after `/`
2. `generateCommandSuggestions()` fuzzy-matches against all registered commands
3. A dropdown renders below the input with arrow-key navigation
4. `getBestCommandMatch()` provides ghost text for inline completion

## State Management

### AppStateStore

A simple immutable store (`Store<T>`) with `getState`/`setState`/`subscribe`. React components subscribe via `useSyncExternalStore` through the `useAppState(selector)` hook.

```typescript
const vimMode = useAppState(s => s.vimMode)
const setState = useSetAppState()
setState(prev => ({ ...prev, vimMode: true }))
```

### Persistence

User preferences (vim mode, theme, output style, effort level) persist to `~/.kite/state.json` with a 2-second debounce. Session data persists as JSONL in `~/.kite/sessions/`.

## Session Persistence

Sessions use **JSONL** (one JSON object per line):
- Line 1: `{ type: "metadata", data: { id, title, model, cwd, ... } }`
- Lines 2+: `{ type: "message", data: { role, content } }`

Functions: `createSession()`, `appendMessage()`, `loadSession()`, `listSessions()`, `saveSessionState()`, `updateSessionMetadata()`, `exportSessionToMarkdown()`.

## Plugin System

Plugins live in `.kite/plugins/<name>/` with a `plugin.json` manifest:

```
plugin.json → parseManifest() → loadPlugin()
  ├── tools/*.js → dynamic import() → Tool objects
  ├── commands/*.js → dynamic import() → Command objects
  └── hooks/*.js → dynamic import() → async hook functions
```

`loadAllPlugins(cwd)` discovers and loads all plugins. `executePluginHook(plugins, hookName, ...args)` runs lifecycle hooks in parallel.

## Auto-Compaction

When the estimated token count exceeds 75% of the model's context window:

1. **MicroCompact** (free, no LLM) — truncate large tool results (>30k chars) and text blocks (>50k chars)
2. **Full Compact** (LLM call) — summarize old messages while preserving the most recent 4 messages and never splitting tool_use/tool_result pairs

At 95% usage, the query loop refuses to send and returns a `blocking_limit` terminal.

## MCP Integration

MCP servers connect via stdio, SSE, or HTTP transport. The built-in Playwright server provides browser tools (navigate, screenshot, click, type, etc.).

Config merging order:
1. Built-in Playwright (lowest priority)
2. Project `.mcp.json`
3. `kite.config.json` mcpServers section
4. Global `~/.kite/config.json` mcpServers section

## Directory Layout

```
kite-ts/
├── src/                    # All source code (221 files, ~52k lines)
│   ├── entrypoints/        # CLI entry point
│   ├── screens/            # REPL (Ink + readline fallback)
│   ├── components/         # 70+ React/Ink components
│   ├── ink/hooks/          # 14 React hooks
│   ├── providers/          # LLM adapters (Anthropic, OpenAI-compatible)
│   ├── tools/              # 29 tool implementations
│   ├── services/           # MCP, compaction, retry, browser, streaming
│   ├── state/              # AppStateStore, persistence, React context
│   ├── plugins/            # Plugin loader
│   ├── skills/             # SKILL.md loader
│   ├── themes/             # 6 color themes
│   ├── utils/              # Shared utilities
│   ├── vim/                # Vim mode engine
│   ├── query/              # Token budget, query deps
│   ├── constants/          # System prompts
│   ├── bootstrap/          # Tool + MCP bootstrapping
│   ├── memdir/             # In-memory directory
│   └── types/              # Shared type definitions
├── dist/                   # Compiled output (gitignored)
├── kite.config.json        # Project config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies and scripts
├── LICENSE                 # MIT
├── README.md               # User-facing documentation
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contributor guide
├── ARCHITECTURE.md         # This file
└── AGENTS.md               # AI agent instructions
```
