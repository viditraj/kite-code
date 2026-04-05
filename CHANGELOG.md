# Changelog

All notable changes to Kite Code will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2025-07-01

### Added

#### Core Engine
- Multi-provider LLM support: Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, and custom OpenAI-compatible endpoints
- Async generator query loop (`query.ts`) with streaming, tool_use accumulation, and multi-turn conversation
- Permission system with Allow / Always allow / Deny per tool, with session memory
- Auto-compaction: two-stage (microcompact + LLM) when context exceeds 75% of model window
- Reactive compaction on max_tokens recovery
- Token budget tracking with continuation decision logic
- Output-tokens recovery with automatic retry (up to 3 attempts)
- AbortController-based cancellation throughout the query loop

#### Session Persistence
- JSONL session storage in `~/.kite/sessions/`
- `--continue` flag to resume the most recent session
- `--resume [id]` to resume by ID, search, or interactive picker
- Session metadata: title auto-generation, token count, cost tracking
- Markdown export via `exportSessionToMarkdown()`
- Automatic cleanup of sessions older than 30 days
- `/rename` command to rename sessions

#### File History
- Content-hash-based dedup for file snapshots
- Monotonic version counter per file
- Auto-backup before file write/edit operations
- Restore support via `restoreFile()`
- Max 100 snapshots per session stored in `~/.kite/snapshots/`

#### Tools (29)
- **Bash** — async spawn with streaming progress, read-only detection, 23 security validators
- **Read** — file and directory reading with line ranges
- **Write** — file creation/overwrite with auto-backup
- **Edit** — exact string replacement with auto-backup
- **Grep** — ripgrep-powered content search
- **Glob** — file pattern matching
- **WebSearch** — DuckDuckGo HTML scraping
- **WebFetch** — URL content extraction with redirect following
- **Agent** — subagent spawning for delegated tasks
- **TodoWrite** — session task checklist with malformed-input normalization
- **AskUserQuestion** — structured user prompts with multiple-choice support
- **LSP** — TypeScript/JavaScript/Python/Rust language server diagnostics
- **NotebookEdit** — Jupyter notebook cell editing
- **PowerShell** — Windows command execution
- **Monitor** — system resource monitoring (CPU/memory/disk)
- **Config** — runtime configuration read/write
- **MCPTool** — call tools on connected MCP servers
- **ListMcpResources / ReadMcpResource** — MCP resource access
- **ScheduleCron** — recurring task scheduling
- **WorktreeTool** — git worktree management
- **VerifyPlan** — plan verification before execution
- **PlanMode** — enter/exit plan mode
- **Sleep, Skill, ToolSearch, SendMessage, TaskTools, SyntheticOutput**

#### Bash Security (6 validators)
- `bashSecurity.ts` — 23 security checks (obfuscated flags, shell metacharacters, dangerous variables, IFS injection, control characters, Unicode whitespace, etc.)
- `bashPermissions.ts` — permission engine with rule matching, wrapper stripping, compound command handling
- `readOnlyValidation.ts` — flag-based validation for 20+ commands, git subcommand allowlists
- `pathValidation.ts` — path extraction from 25+ commands, dangerous removal target detection
- `sedValidation.ts` — print/substitution/dangerous operation validation
- `modeValidation.ts` — acceptEdits mode auto-allow for filesystem commands

#### Commands (48)
- **Navigation:** `/help`, `/model`, `/provider`, `/setup`, `/mode`, `/effort`, `/theme`, `/output-style`, `/thinking`, `/vim`, `/fast`, `/debug`, `/verbose`
- **Session:** `/context`, `/stats`, `/cost`, `/usage`, `/clear`, `/compact`, `/rewind`, `/summary`, `/rename`, `/export`, `/resume`, `/session`, `/copy`
- **System:** `/config`, `/env`, `/sandbox`, `/login`, `/doctor`, `/diff`, `/branch`, `/files`, `/mcp`, `/skills`, `/agents`, `/tasks`, `/hooks`, `/status`, `/keybindings`, `/memory`, `/review`, `/feedback`, `/release-notes`, `/exit`, `/plan`

#### Command Autocomplete
- Fuzzy matching of command names, aliases, and descriptions
- Dropdown suggestion list rendered inline below the prompt
- Arrow-key navigation, Tab to apply, Enter to submit, Escape to dismiss
- Ghost text for inline completion (dimmed suffix)

#### UI Components (70+)
- **REPL:** Ink-based with `<Static>` for message history and live streaming area
- **Markdown rendering:** bold, italic, code blocks (syntax highlighted via highlight.js), tables (box-drawing borders), lists, headings, links
- **Message timestamps:** relative time display ("just now", "2m ago") that auto-updates
- **6 color themes:** dark, light, dark-colorblind, light-colorblind, dark-ansi, light-ansi
- **Welcome screen:** block-letter ASCII art "KITE CODE" with gradient
- **Status bar:** model, provider, git branch, token count, context percentage
- **Interactive pickers:** arrow-key navigation for commands, models, providers, themes, permission modes
- **Permission dialogs:** BashPermissionRequest (with dangerous command detection), FileWritePermissionRequest, FileEditPermissionRequest (inline diff), WebFetchPermissionRequest, MCPServerApprovalDialog
- **Design system:** ThemedBox, ThemedText, Dialog, Divider, FuzzyPicker, KeyboardShortcutHint, ListItem, LoadingState, Pane, StatusIcon, Tabs
- **Feature components:** ContextVisualization, SessionPreview, HistorySearchDialog, OutputStylePicker, QuickOpenDialog, TokenWarning, CompactSummary, FilePathLink, InterruptedByUser, HelpV2

#### React Hooks (14)
- `useInterval` — setInterval with React lifecycle
- `useTerminalSize` — reactive terminal dimensions
- `useVimMode` — full vim editing (normal/insert/visual, motions, operators, yank/paste)
- `useKeybindings` — modal keyboard shortcut manager
- `useElapsedTime` — formatted elapsed time with useSyncExternalStore
- `useTimeout` — setTimeout with auto-cleanup
- `useAfterFirstRender` — callback after component mount
- `useMemoryUsage` — Node.js heap monitoring with status thresholds
- `useDoublePress` — rapid double-press detection (800ms window)
- `useMinDisplayTime` — throttle values for minimum visibility duration
- `useCopyOnSelect` — auto-copy to system clipboard
- `usePasteHandler` — paste detection with chunked aggregation and image path handling
- `useCancelRequest` — unified Escape/Ctrl+C cancel handler with double-press-to-exit
- `useHistorySearch` — Ctrl+R incremental search through command history

#### State Management
- `Store<T>` — immutable state store with `getState`/`setState`/`subscribe`
- `AppStateStore` — typed global state (provider, session, permissions, tokens, MCP, tasks, notifications, UI toggles, git)
- `AppStateProvider` — React context with `useAppState(selector)`, `useSetAppState()`, `useAppStateStore()`
- Disk persistence to `~/.kite/state.json` with debounced auto-save
- `loadPersistedState()` / `savePersistedState()` for preferences across sessions

#### Plugin System
- Plugin discovery from `.kite/plugins/` (project) and `~/.kite/plugins/` (global)
- `plugin.json` manifest format (name, version, description, tools, commands, hooks)
- Dynamic ESM module loading for tool, command, and hook modules
- `executePluginHook()` for lifecycle events across all plugins
- Plugin cache management and error collection

#### Infrastructure
- Provider setup wizard with `--setup` and first-run onboarding
- `--doctor` system diagnostics with connectivity test
- `kite.config.json` with project/global/CLI-flag config loading order
- Session picker UI with search filtering
- Git branch tracking in status bar
- Git utilities (branch, SHA, status, diff, log, worktree detection)
- Skill loading from `.kite/skills/` and `.claude/skills/` with frontmatter metadata
- MCP server management (stdio/SSE/HTTP transports)
- Built-in Playwright MCP server for browser access
- API retry with exponential backoff
- Sandbox support via bubblewrap (bwrap)
- E2E test harness with process spawning
- 692 tests across 32 test files
- Zero TypeScript errors
- MIT license

### Architecture
- TypeScript 5.8+, ESM-only, Node.js 20+
- Ink 4 (React for CLIs) with React 18
- Zod for runtime validation
- Commander for CLI argument parsing
- MCP SDK for Model Context Protocol
- Playwright MCP for browser tools
