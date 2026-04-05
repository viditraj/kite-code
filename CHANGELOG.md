# Changelog

All notable changes to Kite Code will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2025-07-01

### Added

#### Core
- Multi-provider LLM support: Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, and custom OpenAI-compatible endpoints
- Async generator query loop with streaming, tool execution, and multi-turn conversation
- Permission system with Allow / Always allow / Deny per tool, session memory
- Auto-compaction when context window exceeds 80%
- Session persistence to `~/.kite/sessions/` with `--continue` and `--resume` flags
- File history snapshots with content-hash dedup and restore support
- Token tracking with live context window percentage in status bar

#### Tools (31)
- **Bash** — async spawn with streaming progress, read-only detection
- **Read** — file and directory reading with line ranges
- **Write** — file creation/overwrite with auto-backup
- **Edit** — exact string replacement with auto-backup
- **Grep** — ripgrep-powered content search
- **Glob** — file pattern matching
- **WebSearch** — real DuckDuckGo HTML scraping
- **WebFetch** — URL content extraction
- **Agent** — subagent spawning for delegated tasks
- **TodoWrite** — session task checklist with malformed-input normalization
- **AskUserQuestion** — structured user prompts
- **LSP** — TypeScript/JavaScript/Python/Rust language server diagnostics
- **NotebookEdit** — Jupyter notebook editing
- **PowerShell** — Windows command execution
- **Monitor** — system resource monitoring
- **Config** — runtime configuration read/write
- **Sleep**, **Skill**, **ToolSearch**, **EnterPlanMode**, **ExitPlanMode**

#### Commands (47)
- Navigation: `/help`, `/model`, `/provider`, `/setup`, `/mode`, `/effort`, `/theme`, `/output-style`, `/thinking`, `/vim`
- Session: `/context`, `/stats`, `/cost`, `/usage`, `/clear`, `/compact`, `/rewind`, `/summary`, `/export`, `/resume`
- System: `/config`, `/env`, `/sandbox`, `/login`, `/doctor`, `/diff`, `/branch`, `/files`, `/mcp`, `/skills`, `/status`, `/keybindings`

#### UI
- Ink-based REPL with `<Static>` for message history and live streaming area
- Markdown rendering with bold, italic, code blocks (syntax highlighted), tables (box-drawing borders), lists, headings, links
- 6 color themes: dark, light, dark-colorblind, light-colorblind, dark-ansi, light-ansi
- Block-letter ASCII art welcome screen ("KITE CODE")
- Status bar with model, git branch, token count, context percentage
- Interactive arrow-key pickers for commands
- Cursor blink animation in prompt input
- Vim keybinding mode

#### Infrastructure
- Provider setup wizard with `--setup` flag and `/setup` command
- `--doctor` system diagnostics
- `kite.config.json` with project/global/CLI-flag config loading order
- GitHub Actions CI (Node 20/22, Linux/macOS/Windows)
- npm publish pipeline with provenance
- Performance benchmarking script
- E2E test harness with process spawning
- 635 tests across 31 test files
- Zero TypeScript errors
- MIT license

### Architecture
- TypeScript 5.8+, ESM-only, Node.js 20+
- Ink 4 (React for CLIs) with React 18
- Zod for runtime validation
- Commander for CLI argument parsing
- MCP SDK for Model Context Protocol support
- Built-in Playwright MCP server for browser access
