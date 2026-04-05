<p align="center">
  <strong>KITE CODE</strong><br>
  <em>Open-source AI coding CLI — zero telemetry, any LLM provider</em>
</p>

<p align="center">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.8-blue">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Tests: 626" src="https://img.shields.io/badge/tests-626%20passing-brightgreen">
</p>

---

Kite Code is a terminal-based AI coding assistant built with TypeScript and [Ink](https://github.com/vadimdemedes/ink). It connects to **any** LLM provider (Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or custom endpoints) and gives you Claude Code-level functionality with **zero telemetry**, **zero OAuth**, and **zero vendor lock-in**.

## Features

- **31 built-in tools** — Bash (async spawn), file read/write/edit, grep, glob, web search (DuckDuckGo), web fetch, agent spawning, todo management, LSP diagnostics, and more
- **47 slash commands** — `/model`, `/provider`, `/context`, `/stats`, `/effort`, `/theme`, `/rewind`, `/sandbox`, and more — many with interactive arrow-key pickers
- **8 LLM providers** — Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or any OpenAI-compatible endpoint
- **6 color themes** — dark, light, colorblind-friendly, ANSI-only
- **Markdown rendering** — bold, italic, code blocks with syntax highlighting, tables with box-drawing borders, lists, headings, links
- **Session persistence** — auto-saves to `~/.kite/sessions/`, resume with `--continue` or `--resume`
- **File history snapshots** — auto-backups before every file write/edit, restore with `/rewind`
- **Token tracking** — live context window usage in the status bar, `/context` for detailed breakdown
- **Permission system** — Allow / Always allow / Deny per tool, with session memory
- **Provider setup wizard** — guided first-run configuration with `--setup`
- **Zero telemetry** — no analytics, no tracking, no GrowthBook, no Datadog

## Quick Start

### Prerequisites

- **Node.js 20+** — [install](https://nodejs.org/)
- An API key for your chosen LLM provider

### Install (single command)

```bash
# Install globally — gives you the `kite` command
npm install -g @kite-code/cli

# That's it! Run:
kite
```

### Install from source

```bash
git clone https://github.com/kite-code/kite-code.git
cd kite-code
npm install
npm run build
npm link    # Makes `kite` available globally

kite
```

### First Run

On first launch, Kite walks you through a setup wizard:

```
  ██╗  ██╗██╗████████╗███████╗
  ██║ ██╔╝██║╚══██╔══╝██╔════╝
  █████╔╝ ██║   ██║   █████╗    CODE
  ██╔═██╗ ██║   ██║   ██╔══╝
  ██║  ██╗██║   ██║   ███████╗
  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝

  Welcome to Kite Code!

  Step 1: Choose a color theme → dark, light, colorblind, ANSI
  Step 2: Configure your LLM provider → Anthropic, OpenAI, Ollama, etc.
  Step 3: Security notes → review and continue
```

The walkthrough saves your preferences to `~/.kite/config.json` (theme) and
`kite.config.json` (provider). It only runs once. Re-run with `kite --setup`.

Or configure manually:

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Or for OpenAI
export OPENAI_API_KEY="sk-..."

# Or for local Ollama (no key needed)
# Just start ollama serve
```

## Configuration

Kite uses `kite.config.json` in your project directory:

```json
{
  "provider": {
    "name": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  },
  "behavior": {
    "permissionMode": "default",
    "maxTokens": 8192
  }
}
```

### Config Loading Order (highest to lowest priority)

1. CLI flags (`--model`, `--provider`, etc.)
2. Project config (`./kite.config.json`)
3. Global config (`~/.kite/config.json`)
4. Built-in defaults

### Provider Examples

<details>
<summary><strong>Anthropic (Claude)</strong></summary>

```json
{
  "provider": {
    "name": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  }
}
```
</details>

<details>
<summary><strong>OpenAI (GPT)</strong></summary>

```json
{
  "provider": {
    "name": "openai",
    "model": "gpt-4o",
    "apiKeyEnv": "OPENAI_API_KEY"
  }
}
```
</details>

<details>
<summary><strong>Ollama (Local)</strong></summary>

```json
{
  "provider": {
    "name": "ollama",
    "model": "llama3.1",
    "apiBaseUrl": "http://localhost:11434"
  }
}
```
No API key needed. Just run `ollama serve` and `ollama pull llama3.1`.
</details>

<details>
<summary><strong>Custom / Self-Hosted</strong></summary>

```json
{
  "provider": {
    "name": "my-endpoint",
    "model": "my-model",
    "apiKeyEnv": "MY_API_KEY",
    "apiBaseUrl": "https://my-server.com/v1/chat/completions",
    "verifySsl": false
  }
}
```
Any OpenAI-compatible endpoint works.
</details>

## CLI Usage

```bash
# Interactive mode (default)
kite

# Non-interactive mode (print and exit)
kite -p "explain this error" < error.log

# Resume last session
kite --continue

# Resume specific session by ID
kite --resume abc12345

# Browse and pick a session interactively
kite --resume

# Search sessions then pick
kite --resume "refactor auth"

# Use a specific model
kite --model gpt-4o

# System diagnostics
kite --doctor

# Provider setup wizard
kite --setup

# Show help
kite --help
```

### All CLI Flags

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode (print response and exit) |
| `-c, --continue` | Resume the most recent session |
| `-r, --resume [id]` | Resume by ID, or open interactive session picker |
| `--model <model>` | Override model for this session |
| `--provider <name>` | Override provider name |
| `--permission-mode <mode>` | Set permission mode |
| `--system-prompt <text>` | Custom system prompt |
| `--max-tokens <n>` | Max output tokens |
| `--config <path>` | Path to config file |
| `--doctor` | Run system diagnostics |
| `--setup` | Launch provider setup wizard |
| `-d, --debug` | Enable debug logging |
| `--verbose` | Verbose output |

## Commands Reference

Type `/help` in the REPL to see all commands with an interactive picker.

### Navigation & Config

| Command | Description |
|---------|-------------|
| `/help` | Interactive command picker |
| `/model [name]` | Show or switch AI model |
| `/provider [name]` | Show or switch LLM provider |
| `/setup` | Launch provider setup wizard |
| `/mode [mode]` | Change permission mode |
| `/effort [level]` | Set effort level (low/medium/high) |
| `/theme` | Change color theme (6 themes) |
| `/output-style [style]` | Set verbosity (verbose/concise/brief) |
| `/thinking` | Toggle thinking/reasoning display |
| `/vim` | Toggle vim keybinding mode |

### Session & Context

| Command | Description |
|---------|-------------|
| `/context` | Token usage visualization with progress bar |
| `/stats` | Session statistics (duration, tokens, memory) |
| `/cost` | Session cost breakdown |
| `/usage` | API usage statistics |
| `/clear` | Clear conversation history |
| `/compact` | Compact conversation to save context |
| `/rewind` | Undo last user+assistant exchange |
| `/summary` | Ask the LLM to summarize the conversation |
| `/export [file]` | Export conversation to markdown |
| `/resume [id]` | Resume a previous session |

### Tools & System

| Command | Description |
|---------|-------------|
| `/config` | Show current configuration |
| `/env` | Show environment information |
| `/sandbox [on\|off]` | Show or toggle sandbox mode |
| `/login` | Configure API key |
| `/doctor` | Run system diagnostics |
| `/diff` | Show git changes |
| `/branch [name]` | Show or switch git branch |
| `/files` | List modified files |
| `/mcp` | Show MCP server status |
| `/skills` | List available skills |
| `/status` | System status |
| `/keybindings` | Keyboard shortcuts |

## Tools

Kite has **31 built-in tools** that the AI can use:

### Core File Operations
| Tool | Description | Permission |
|------|-------------|------------|
| `Bash` | Execute shell commands (async spawn) | Ask |
| `Read` | Read files, directories | Auto-allow |
| `Write` | Create or overwrite files | Ask |
| `Edit` | Modify files (exact string replacement) | Ask |
| `Grep` | Search file contents (ripgrep) | Auto-allow |
| `Glob` | Find files by pattern | Auto-allow |

### Web & Network
| Tool | Description | Permission |
|------|-------------|------------|
| `WebSearch` | Search the web (DuckDuckGo) | Auto-allow |
| `WebFetch` | Fetch and extract URL content | Ask |

### Agent & Workflow
| Tool | Description | Permission |
|------|-------------|------------|
| `Agent` | Spawn subagents for delegated tasks | Auto-allow |
| `TodoWrite` | Manage session task checklist | Auto-allow |
| `AskUserQuestion` | Prompt user with questions | Auto-allow |
| `EnterPlanMode` | Switch to planning mode | Auto-allow |
| `ExitPlanMode` | Exit planning mode | Auto-allow |

### Advanced
| Tool | Description | Permission |
|------|-------------|------------|
| `LSP` | Language server diagnostics (TS/JS/Python/Rust) | Auto-allow |
| `NotebookEdit` | Edit Jupyter notebooks | Ask |
| `ToolSearch` | Search for deferred tools | Auto-allow |
| `WebSearch` | Search internet (DuckDuckGo) | Auto-allow |
| `PowerShell` | Execute PowerShell commands (Windows) | Ask |
| `Monitor` | System monitoring (CPU/memory/disk) | Auto-allow |
| `Config` | Read/write kite.config.json | Auto-allow |
| `Sleep` | Delay execution | Auto-allow |
| `Skill` | Execute custom skills | Auto-allow |

## Themes

Kite ships with 6 color themes. Switch with `/theme`:

| Theme | Description |
|-------|-------------|
| `dark` | Default — cyan/magenta on dark background |
| `light` | Blue/magenta on light background |
| `dark-colorblind` | Deuteranopia-friendly (orange replaces red, blue replaces green) |
| `light-colorblind` | Light variant of colorblind theme |
| `dark-ansi` | Basic 8 ANSI colors only |
| `light-ansi` | Light variant with basic ANSI colors |

## Permission System

Kite asks before executing tools that modify files or run commands:

```
────────────────────────────────────────────────────────────
⚡ Bash — command: npm install lodash
  Kite wants to use Bash, but you haven't granted permission yet.

 Allow (y)   Always allow (a)   Deny (n)
────────────────────────────────────────────────────────────
```

- **y** — Allow this one use
- **a** — Always allow this tool for the rest of the session
- **n** — Deny (Escape also denies)

### Permission Modes

Set with `--permission-mode` or `/mode`:

| Mode | Description |
|------|-------------|
| `default` | Ask for each tool use |
| `acceptEdits` | Auto-accept file edits |
| `plan` | Planning mode (no execution) |
| `bypassPermissions` | Allow all tools |
| `dontAsk` | Never ask (deny if would ask) |

## Architecture

```
kite-ts/
├── src/
│   ├── entrypoints/cli.ts      # CLI entry point
│   ├── screens/REPL.tsx         # Main Ink REPL component
│   ├── QueryEngine.ts           # Query orchestration
│   ├── query.ts                 # Async generator query loop
│   ├── Tool.ts                  # Tool interface + buildTool factory
│   ├── tools.ts                 # Tool registry
│   ├── commands.ts              # 47 slash commands
│   ├── providers/               # LLM provider adapters
│   │   ├── anthropic.ts         # Anthropic (Claude)
│   │   ├── openai-compatible.ts # OpenAI, Ollama, Groq, etc.
│   │   └── factory.ts           # Provider resolution
│   ├── tools/                   # 31 tool implementations
│   ├── components/              # 62+ Ink/React UI components
│   │   ├── messages/            # Message rendering
│   │   ├── permissions/         # Permission dialogs
│   │   ├── design-system/       # 12 design system primitives
│   │   ├── MarkdownText.tsx     # Markdown renderer
│   │   ├── StatusBar.tsx        # Status bar
│   │   └── LogoV2/              # Welcome screen
│   ├── themes/                  # 6 color themes
│   ├── services/                # MCP, compaction, API
│   └── utils/                   # Config, permissions, format, session
├── kite.config.json             # Project configuration
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with tsx, no build needed)
npm start

# Run with watch mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Type check only
npm run typecheck

# Run specific test file
npx vitest run src/tools/tools.test.ts
```

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 168 |
| Source lines | 42,054 |
| Tools | 31 |
| Commands | 47 |
| Components | 62+ |
| Providers | 8 |
| Themes | 6 |
| Tests | 626 passing |
| TypeScript errors | 0 |

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

Kite Code is inspired by [Claude Code](https://github.com/anthropics/claude-code) by Anthropic. It studies Claude Code's architecture and implements equivalent functionality as an open-source, provider-agnostic alternative.

Built with:
- [Ink](https://github.com/vadimdemedes/ink) — React for CLIs
- [Zod](https://github.com/colinhacks/zod) — Runtime validation
- [Commander](https://github.com/tj/commander.js) — CLI argument parsing
