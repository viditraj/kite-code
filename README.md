<p align="center">
  <img width="841" height="793" align="center" alt="image" src="https://github.com/user-attachments/assets/e1fa5974-c981-4ae4-93ca-999dcaa1cdbe" />
</p>

<p align="center">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.8-blue">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Tests: 692" src="https://img.shields.io/badge/tests-692%20passing-brightgreen">
</p>

---

Kite Code is a general-purpose AI terminal assistant built with TypeScript and [Ink](https://github.com/vadimdemedes/ink). It connects to **any** LLM provider (Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or custom endpoints) and gives you a powerful AI agent with web search, web browsing, shell access, file operations, and 29 built-in tools — with **zero telemetry**, **zero OAuth**, and **zero vendor lock-in**. Not just for coding — ask it anything.

## Features

- **29 built-in tools** — Bash, file read/write/edit, grep, glob, web search, web fetch, agent spawning, todo management, LSP diagnostics, MCP integration, and more
- **48 slash commands** — `/model`, `/provider`, `/context`, `/stats`, `/effort`, `/theme`, `/rewind`, `/rename`, `/sandbox`, and more — many with interactive arrow-key pickers
- **Command autocomplete** — type `/` and get a fuzzy-matched dropdown with arrow-key navigation, Tab to apply, ghost text for inline completion
- **Message timestamps** — relative timestamps ("just now", "2m ago", "1h ago") on user and assistant messages
- **8 LLM providers** — Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or any OpenAI-compatible endpoint
- **6 color themes** — dark, light, colorblind-friendly, ANSI-only
- **Markdown rendering** — bold, italic, code blocks with syntax highlighting, tables with box-drawing borders, lists, headings, links
- **Session persistence** — auto-saves to `~/.kite/sessions/`, resume with `--continue` or `--resume`
- **File history snapshots** — auto-backups before every file write/edit, restore with `/rewind`
- **Auto-compaction** — automatically compacts conversation when approaching context window limits
- **Token tracking** — live context window usage in the status bar, `/context` for detailed breakdown with visual bar
- **Permission system** — Allow / Always allow / Deny per tool, with session memory and per-tool permission dialogs
- **Plugin system** — load custom tools, commands, and hooks from `.kite/plugins/`
- **14 React hooks** — useElapsedTime, useHistorySearch, useDoublePress, useMinDisplayTime, useTimeout, useCancelRequest, and more
- **Typed state management** — AppStateStore with React context, selectors, and disk persistence
- **Provider setup wizard** — guided first-run onboarding with `--setup`
- **Zero telemetry** — no analytics, no tracking, no GrowthBook, no Datadog

## Quick Start

### Prerequisites

- **Node.js 20+** — [install](https://nodejs.org/)
- An API key for your chosen LLM provider

### Install from npm

```bash
npm install -g @viditraj/kite-code
kite
```

### Install from source

```bash
git clone https://github.com/viditraj/kite-code.git
cd kite-code
npm install
npm run build
npm link
kite
```

### First Run

On first launch, Kite walks you through a setup wizard:

<img width="600" height="725" alt="image" src="https://github.com/user-attachments/assets/07029fd4-cdf4-47c2-a456-e13ab7a19ce3" />


The walkthrough saves your preferences to `~/.kite/config.json` (theme) and
`kite.config.json` (provider). It only runs once. Re-run anytime with `kite --setup`.

Or configure manually:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."   # Anthropic
export OPENAI_API_KEY="sk-..."          # OpenAI
# Ollama needs no key — just `ollama serve`
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

### Config Loading Order

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
No API key needed. Run `ollama serve` and `ollama pull llama3.1`.
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
kite                              # Interactive REPL (default)
kite -p "explain this error"      # Non-interactive, print and exit
kite --continue                   # Resume last session
kite --resume abc12345            # Resume specific session
kite --resume                     # Interactive session picker
kite --resume "refactor auth"     # Search sessions then pick
kite --model gpt-4o              # Override model
kite --doctor                     # System diagnostics
kite --setup                      # Provider setup wizard
kite --help                       # Show help
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode (print response and exit) |
| `-c, --continue` | Resume the most recent session |
| `-r, --resume [id]` | Resume by ID, or open interactive session picker |
| `--model <model>` | Override model for this session |
| `--provider <name>` | Override provider name |
| `--permission-mode <mode>` | Set permission mode |
| `--system-prompt <text>` | Custom system prompt |
| `--append-system-prompt <text>` | Append to default system prompt |
| `--max-tokens <n>` | Max output tokens |
| `--max-budget-usd <n>` | Max session cost in USD |
| `--config <path>` | Path to config file |
| `--allowed-tools <tools...>` | Tools to allow |
| `--disallowed-tools <tools...>` | Tools to deny |
| `--mcp-config <configs...>` | MCP server config files |
| `--doctor` | Run system diagnostics |
| `--setup` | Launch provider setup wizard |
| `-d, --debug` | Enable debug logging |
| `--verbose` | Verbose output |
| `--bare` | Minimal mode: skip hooks, plugins, auto-memory |

## Commands

Type `/` and get autocomplete suggestions. Type `/help` for the interactive command picker.

### Navigation & Config

| Command | Description |
|---------|-------------|
| `/help` | Interactive command picker with arrow-key navigation |
| `/model [name]` | Show or switch AI model (interactive picker when no args) |
| `/provider [name]` | Show or switch LLM provider (interactive picker when no args) |
| `/setup` | Launch provider setup wizard |
| `/mode [mode]` | Change permission mode (interactive picker when no args) |
| `/effort [level]` | Set effort level: low / medium / high |
| `/theme [name]` | Change color theme (interactive picker when no args) |
| `/output-style [style]` | Set verbosity: verbose / concise / brief |
| `/thinking` | Toggle thinking/reasoning display |
| `/vim` | Toggle vim keybinding mode |
| `/fast` | Toggle fast mode (use faster model) |
| `/debug` | Toggle debug logging |
| `/verbose` | Toggle verbose output |

### Session & Context

| Command | Description |
|---------|-------------|
| `/context` | Token usage visualization with progress bar |
| `/stats` | Session statistics (duration, tokens, memory, model) |
| `/cost` | Session cost breakdown (input/output/cache tokens) |
| `/usage` | API usage statistics |
| `/clear` | Clear conversation history |
| `/compact [instructions]` | Compact conversation to save context |
| `/rewind` | Undo last user+assistant exchange |
| `/summary` | Ask the LLM to summarize the conversation |
| `/rename <name>` | Rename the current session |
| `/export [file]` | Export conversation to markdown |
| `/resume [id]` | Resume a previous session |
| `/session` | Show session information |
| `/copy` | Copy last response to clipboard |

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
| `/mcp` | Show MCP server status and tools |
| `/skills` | List available skills |
| `/agents` | List available agent types |
| `/tasks` | Show background tasks |
| `/hooks` | Show configured hooks |
| `/status` | System status |
| `/keybindings` | Keyboard shortcuts |
| `/memory` | Show AGENTS.md / CLAUDE.md memory files |
| `/review [scope]` | Review code changes |
| `/feedback <text>` | Send feedback |
| `/release-notes` | Show release notes |
| `/exit` | Exit Kite |

## Tools

Kite has **29 built-in tools** that the AI can use:

| Tool | Description | Permission |
|------|-------------|------------|
| `Bash` | Execute shell commands (async spawn with streaming) | Ask |
| `Read` | Read files and directories with line ranges | Auto-allow |
| `Write` | Create or overwrite files | Ask |
| `Edit` | Modify files via exact string replacement | Ask |
| `Grep` | Search file contents (ripgrep) | Auto-allow |
| `Glob` | Find files by glob pattern | Auto-allow |
| `WebSearch` | Search the web via DuckDuckGo | Auto-allow |
| `WebFetch` | Fetch and extract URL content | Ask |
| `Agent` | Spawn subagents for delegated tasks | Auto-allow |
| `TodoWrite` | Manage session task checklist | Auto-allow |
| `AskUserQuestion` | Prompt user with structured questions | Auto-allow |
| `LSP` | Language server diagnostics (TS/JS/Python/Rust) | Auto-allow |
| `NotebookEdit` | Edit Jupyter notebooks | Ask |
| `PowerShell` | Execute PowerShell commands (Windows) | Ask |
| `Monitor` | System resource monitoring (CPU/memory/disk) | Auto-allow |
| `Config` | Read/write kite.config.json | Auto-allow |
| `ToolSearch` | Search for deferred tools | Auto-allow |
| `Skill` | Execute custom skills from .kite/skills/ | Auto-allow |
| `MCPTool` | Call tools on connected MCP servers | Ask |
| `ListMcpResources` | List resources from MCP servers | Auto-allow |
| `ReadMcpResource` | Read a specific MCP resource | Auto-allow |
| `SendMessage` | Send messages to background agents | Auto-allow |
| `ScheduleCron` | Schedule recurring tasks | Ask |
| `WorktreeTool` | Manage git worktrees | Ask |
| `VerifyPlan` | Verify a plan before execution | Auto-allow |
| `PlanMode` | Enter/exit plan mode | Auto-allow |
| `Sleep` | Delay execution | Auto-allow |
| `TaskTools` | Manage background tasks | Auto-allow |
| `SyntheticOutput` | Generate synthetic tool output | Auto-allow |

## Themes

Switch with `/theme`:

| Theme | Description |
|-------|-------------|
| `dark` | Default — cyan/magenta on dark background |
| `light` | Blue/magenta on light background |
| `dark-colorblind` | Deuteranopia-friendly (orange/blue palette) |
| `light-colorblind` | Light variant of colorblind theme |
| `dark-ansi` | Basic 8 ANSI colors only |
| `light-ansi` | Light variant with basic ANSI colors |

## Permission System

Kite asks before executing tools that modify files or run commands:

```
────────────────────────────────────────────────────────────
  Bash — command: npm install lodash

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
| `acceptEdits` | Auto-accept file edits, still ask for Bash |
| `plan` | Planning mode — explore only, no modifications |
| `bypassPermissions` | Allow all tools without asking |
| `dontAsk` | Never ask — deny anything that would ask |

## Plugins

Kite supports a plugin system for extending functionality:

```
.kite/plugins/
  my-plugin/
    plugin.json       # Plugin manifest
    tools/            # Custom tool modules
    commands/         # Custom command modules
    hooks/            # Lifecycle hook handlers
```

### Plugin Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "tools": ["./tools/myTool.js"],
  "commands": ["./commands/myCommand.js"],
  "hooks": {
    "onSessionStart": "./hooks/onStart.js"
  }
}
```

Plugins are loaded from both project-level (`.kite/plugins/`) and global (`~/.kite/plugins/`).

## Skills

Skills are markdown-based command extensions. Create `.kite/skills/<name>/SKILL.md`:

```markdown
---
name: deploy
description: Deploy the application
arguments: [environment]
allowedTools: [Bash, Read]
---

Deploy the application to the {{environment}} environment.
Follow the deployment checklist in DEPLOY.md.
```

Then invoke with `/deploy production`.

## MCP (Model Context Protocol)

Kite integrates with MCP servers. A built-in Playwright server provides browser tools automatically.

### Configure MCP Servers

Add to `.mcp.json` or `kite.config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}
```

Use `/mcp` to check server status.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

```
src/
├── entrypoints/cli.ts          # CLI boot sequence and arg parsing
├── screens/REPL.tsx            # Ink-based interactive REPL
├── screens/readlineRepl.ts     # Fallback readline REPL
├── QueryEngine.ts              # Query orchestration
├── query.ts                    # Async generator query loop
├── Tool.ts                     # Tool interface + factory
├── tools.ts                    # Tool registry
├── commands.ts                 # 48 slash commands
├── providers/                  # LLM provider adapters
├── tools/                      # 29 tool implementations
├── components/                 # 70+ Ink/React UI components
├── ink/hooks/                  # 14 React hooks
├── state/                      # AppStateStore + persistence
├── plugins/                    # Plugin loader system
├── services/                   # MCP, compaction, retry, browser
├── themes/                     # 6 color themes
├── skills/                     # Skill loading from SKILL.md
├── utils/                      # Config, permissions, session, git, bash
└── vim/                        # Vim mode (motions, operators, text objects)
```

## Development

```bash
npm install           # Install dependencies
npm start             # Run with tsx (no build needed)
npm run dev           # Watch mode
npm run build         # Build TypeScript to dist/
npm test              # Run all 692 tests
npm run typecheck     # Type check only
npx vitest run src/path/to/test.ts   # Run specific test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 221 |
| Source lines | 51,936 |
| Tools | 29 |
| Commands | 48 |
| React hooks | 14 |
| Components | 70+ |
| Providers | 8 |
| Themes | 6 |
| Tests | 692 passing |
| Test files | 32 |
| TypeScript errors | 0 |

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

Kite Code is inspired by [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic. It studies Claude Code's architecture and implements equivalent functionality as an open-source, provider-agnostic alternative.

Built with:
- [Ink](https://github.com/vadimdemedes/ink) — React for CLIs
- [Zod](https://github.com/colinhacks/zod) — Runtime validation
- [Commander](https://github.com/tj/commander.js) — CLI argument parsing
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol
- [Playwright MCP](https://github.com/playwright-community/playwright-mcp) — Browser automation
