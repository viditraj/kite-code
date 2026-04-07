<p align="center">
  <img width="841" height="793" align="center" alt="image" src="https://github.com/user-attachments/assets/e1fa5974-c981-4ae4-93ca-999dcaa1cdbe" />
</p>

<p align="center">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.8-blue">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Tests: 772" src="https://img.shields.io/badge/tests-772%20passing-brightgreen">
</p>

---

Kite Code is a general-purpose AI terminal assistant built with TypeScript and [Ink](https://github.com/vadimdemedes/ink). It connects to **any** LLM provider (Anthropic, OpenAI, Ollama, Groq, DeepSeek, Mistral, OpenRouter, or custom endpoints) and gives you a powerful AI agent with web search, web browsing, shell access, file operations, HTTP API calls, headless pipelines, and 35+ built-in tools — with **zero telemetry**, **zero OAuth**, and **zero vendor lock-in**. Not just for coding — ask it anything.

## Features

- **35+ built-in tools** — Bash, file read/write/edit, grep, glob, web search, web fetch, HTTP requests, agent spawning, todo management, LSP diagnostics, MCP integration, pipeline automation, and more
- **50 slash commands** — `/model`, `/provider`, `/context`, `/stats`, `/effort`, `/theme`, `/rewind`, `/rename`, `/sandbox`, `/permissions`, and more — many with interactive arrow-key pickers
- **Headless Pipeline Engine** — define YAML-based automation pipelines that run on a schedule, triggered by webhooks, or on demand — each stage is an autonomous LLM agent
- **Full HTTP Client** — `HttpRequest` tool for REST APIs, webhooks, JIRA, Confluence, GitHub, Slack — any HTTP service with auth and custom headers
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
- **Vim mode** — full vim keybindings in the input area (motions, operators, text objects, dot repeat)
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
kite pipeline list                # List all pipelines
kite pipeline run <name>          # Run a pipeline
kite pipeline daemon              # Start the pipeline scheduler
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

### Pipeline Subcommands

| Command | Description |
|---------|-------------|
| `kite pipeline list` | Discover and list all pipelines |
| `kite pipeline run <name>` | Execute a pipeline by name |
| `kite pipeline run <name> --dry-run` | Plan-only mode (no write operations) |
| `kite pipeline run <name> --set key=value` | Run with variable overrides |
| `kite pipeline status <name>` | Show run history for a pipeline |
| `kite pipeline status <name> --run <id>` | Get detailed results for a specific run |
| `kite pipeline validate <file>` | Validate a pipeline YAML file |
| `kite pipeline daemon` | Start the cron scheduler (long-running) |
| `kite pipeline daemon --once` | Run all due pipelines once and exit |

## Commands

Type `/` and get autocomplete suggestions. Type `/help` for the interactive command picker.

### Navigation & Config

| Command | Description |
|---------|-------------|
| `/help` | Interactive command picker with arrow-key navigation |
| `/model [name]` | Show or switch AI model (interactive picker when no args) |
| `/provider [name]` | Show or switch LLM provider (interactive picker when no args) |
| `/provider-settings [setting] [value]` | View or edit provider settings |
| `/setup` | Launch provider setup wizard |
| `/mode [mode]` | Change permission mode (interactive picker when no args) |
| `/effort [level]` | Set effort level: low / medium / high |
| `/theme [name]` | Change color theme (interactive picker when no args) |
| `/output-style [style]` | Set verbosity: verbose / concise / brief |
| `/thinking` | Toggle thinking/reasoning display |
| `/vim` | Toggle vim keybinding mode |
| `/fast` | Toggle fast mode (use faster model) |
| `/login` | Show API key setup instructions |
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
| `/permissions` | Show current permission rules |
| `/review [scope]` | Review code changes |
| `/plan` | Enter plan mode |
| `/feedback <text>` | Send feedback |
| `/release-notes` | Show release notes |
| `/exit` | Exit Kite |

## Tools

Kite has **35+ built-in tools** that the AI can use:

### Core File Operations

| Tool | Description | Permission |
|------|-------------|------------|
| `Bash` | Execute shell commands with async spawn, streaming, and auto-backgrounding | Ask |
| `PowerShell` | Execute PowerShell commands (Windows) | Ask |
| `Read` | Read files and directories with line ranges | Auto-allow |
| `Write` | Create or overwrite files (auto-creates parent dirs) | Ask |
| `Edit` | Modify files via exact string replacement | Ask |
| `Grep` | Search file contents via ripgrep (regex, context, multiple output modes) | Auto-allow |
| `Glob` | Find files by glob pattern | Auto-allow |
| `NotebookEdit` | Edit Jupyter notebook cells (replace, insert, delete) | Ask |

### Web & Network

| Tool | Description | Permission |
|------|-------------|------------|
| `WebSearch` | Search the web via DuckDuckGo (no API key required) | Auto-allow |
| `WebFetch` | Fetch URL content with HTML-to-Markdown conversion and caching | Ask |
| `HttpRequest` | Full HTTP client (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS) with headers, auth, and body support | Ask (mutating) / Auto-allow (GET) |

### Agent & Workflow

| Tool | Description | Permission |
|------|-------------|------------|
| `Agent` | Spawn subagents (Explore, Plan, GeneralPurpose) for delegated tasks | Auto-allow |
| `TodoWrite` | Manage session task checklist with status tracking | Auto-allow |
| `AskUserQuestion` | Prompt user with multiple-choice questions | Auto-allow |
| `SendMessage` | Inter-agent communication for background agents | Auto-allow |
| `EnterPlanMode` | Switch to explore-only plan mode | Auto-allow |
| `ExitPlanMode` | Present plan for user approval | Auto-allow |
| `VerifyPlan` | Verify plan execution against conversation history | Auto-allow |

### Team & Task Management

| Tool | Description | Permission |
|------|-------------|------------|
| `TeamCreate` | Create multi-agent swarm teams with shared task lists | Auto-allow |
| `TeamDelete` | Disband a team | Auto-allow |
| `TaskCreate` | Create background tasks with metadata | Auto-allow |
| `TaskGet` | Retrieve a task by ID | Auto-allow |
| `TaskList` | List all background tasks | Auto-allow |
| `TaskUpdate` | Update task status, description, or dependencies | Auto-allow |
| `TaskStop` | Stop a running background task | Auto-allow |
| `TaskOutput` | Read output from a background task (with blocking support) | Auto-allow |

### Pipeline Automation

| Tool | Description | Permission |
|------|-------------|------------|
| `PipelineRun` | Execute a pipeline by name (supports dry-run and variable overrides) | Auto-allow |
| `PipelineList` | Discover and list all available pipelines | Auto-allow |
| `PipelineStatus` | Show run history and per-stage results for a pipeline | Auto-allow |
| `PipelineValidate` | Validate a pipeline YAML definition | Auto-allow |
| `PipelineDelete` | Remove a pipeline definition file | Ask |

### Code Intelligence & Utilities

| Tool | Description | Permission |
|------|-------------|------------|
| `LSP` | Language server diagnostics (TypeScript, JavaScript, Python, Rust) | Auto-allow |
| `Monitor` | System resource monitoring (CPU, memory, disk) | Auto-allow |
| `Config` | Read/write `kite.config.json` settings | Auto-allow |
| `Diagram` | Generate SVG/PNG diagrams from Mermaid or ANSI text | Auto-allow |
| `REPL` | Batch tool execution mode | Auto-allow |
| `Skill` | Execute custom skills from `.kite/skills/` | Auto-allow |
| `ToolSearch` | Search for deferred/hidden tools by keyword | Auto-allow |
| `Sleep` | Delay execution (max 5 min) | Auto-allow |
| `SyntheticOutput` | Generate formatted synthetic output (text/JSON/markdown) | Auto-allow |

### MCP & Extensions

| Tool | Description | Permission |
|------|-------------|------------|
| `MCPTool` | Call tools on connected MCP servers | Ask |
| `ListMcpResources` | List resources from MCP servers | Auto-allow |
| `ReadMcpResource` | Read a specific MCP resource | Auto-allow |

### Scheduling & Git

| Tool | Description | Permission |
|------|-------------|------------|
| `ScheduleCronCreate` | Create a scheduled cron task | Auto-allow |
| `ScheduleCronList` | List all scheduled cron tasks | Auto-allow |
| `ScheduleCronDelete` | Remove a scheduled cron task | Auto-allow |
| `EnterWorktree` | Create a git worktree for parallel branch work | Ask |
| `ExitWorktree` | Remove a git worktree | Ask |

## Pipelines

Kite includes a headless pipeline engine for automating recurring tasks. Pipelines are YAML files where each stage is an autonomous LLM agent prompt. The agent decides which tools to use.

### Quick Example

Create `.kite/pipelines/my-pipeline.yaml`:

```yaml
name: my-pipeline
description: Analyze codebase and generate a report

trigger:
  type: manual

settings:
  permissionMode: bypassPermissions
  maxTurns: 30

stages:
  - name: gather-info
    prompt: |
      Run `git log --oneline -10` and `npm test` to gather
      project status. Report the results in structured format.
    tools: [Bash]

  - name: generate-report
    prompt: |
      Based on these results:
      {{ stages.gather-info.output }}

      Write a summary report to ./STATUS_REPORT.md
    tools: [Write, Bash]
```

Run it:

```bash
kite pipeline run my-pipeline
```

### Pipeline Features

- **YAML-based**: human-readable pipeline definitions in `.kite/pipelines/`
- **Stage-by-stage execution**: each stage gets its own LLM agent via `QueryEngine`
- **`{{ }}` interpolation**: pass data between stages with `{{ stages.<name>.output }}`
- **Tool whitelisting**: restrict which tools each stage can use
- **Conditions**: skip stages with `condition: "{{ stages.prev.status }} == completed"`
- **Early termination**: halt the pipeline with `stopIf: "NO_ISSUES_FOUND"`
- **Retries**: per-stage and per-pipeline retry counts
- **Cost budgets**: `maxCostUsd` to prevent runaway spending
- **Dry-run mode**: `--dry-run` to plan without writing
- **Failure notifications**: webhook or command on failure
- **Run history**: JSONL logs in `~/.kite/pipelines/logs/` with `kite pipeline status`

### Trigger Types

| Trigger | Description |
|---------|-------------|
| `manual` | Run on demand with `kite pipeline run <name>` |
| `cron` | Scheduled via cron expression (e.g., `0 */2 * * *` for every 2 hours) |
| `webhook` | Triggered by HTTP webhook (with optional secret) |
| `file-watch` | Triggered when files change (with debounce) |

### Pipeline Settings

```yaml
settings:
  model: claude-sonnet-4          # LLM model override
  maxTurns: 50                    # Max agent turns per stage
  permissionMode: bypassPermissions  # No prompts (headless)
  maxCostUsd: 5.00                # Budget cap per run
  cwd: /path/to/project           # Working directory
  maxTokens: 8192                 # Max output tokens per turn
  env:                            # Environment variables
    JIRA_TOKEN: ${JIRA_API_TOKEN}
```

### Stage Options

```yaml
stages:
  - name: my-stage
    prompt: "..."                 # LLM prompt (supports {{ }} interpolation)
    tools: [Read, Grep, Bash]     # Tool whitelist (default: all)
    agent: Explore                # Agent type: Explore (read-only), Plan, or omit
    condition: "{{ ... }}"        # Skip if falsy
    stopIf: "NO_DATA"            # Halt pipeline if output contains this
    optional: true                # Failure doesn't stop pipeline
    timeout: 300000               # Stage timeout in ms (default: 5 min)
    retries: 2                    # Retry count for this stage
    model: gpt-4o                 # Model override for this stage
    systemPrompt: "Extra context" # Appended to the stage system prompt
```

### Use Cases

- **Defect solver**: Poll JIRA for SEV3 bugs, analyze codebase, implement fixes, raise PRs
- **PR reviewer**: Fetch open PRs on a schedule, review code, post comments
- **Documentation sync**: Gather weekly metrics and update Confluence pages
- **Nightly health checks**: Run build + tests, report results to Slack
- **Dependency audits**: Check for outdated packages, create upgrade PRs

### Daemon Mode

Start the cron scheduler for all pipelines with `trigger.type: cron`:

```bash
kite pipeline daemon              # Long-running scheduler
kite pipeline daemon --once       # Run all due pipelines once and exit
```

The daemon auto-discovers pipelines from `.kite/pipelines/` and `~/.kite/pipelines/`, prevents concurrent runs of the same pipeline, and re-scans for new pipelines every 5 minutes.

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

### Skill Options

| Field | Description |
|-------|-------------|
| `name` | Skill name (becomes the slash command) |
| `description` | Help text shown in command picker |
| `arguments` | Named arguments (substituted via `{{arg}}`) |
| `allowedTools` | Restrict which tools the skill can use |
| `model` | Model override for this skill |
| `context` | `inline` (same conversation) or `fork` (new context) |
| `agent` | Agent type to use (Explore, Plan) |
| `paths` | File paths to auto-include as context |

## MCP (Model Context Protocol)

Kite integrates with MCP servers. A built-in Playwright server provides 27 browser tools automatically (headless Chromium with vision/screenshot support).

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

### MCP Config Locations (priority order)

1. Built-in Playwright browser (lowest)
2. User: `~/.kite/config.json` → `mcpServers`
3. Project: `.mcp.json` or `mcp.json`
4. Local: `.kite/mcp.json` or `kite.config.json` → `mcpServers`

### Browser Tools

The built-in Playwright MCP server provides browser automation:

- `browser_navigate` — go to a URL
- `browser_take_screenshot` — capture page screenshot (returns image)
- `browser_click` — click an element by accessibility ref
- `browser_type` — type text into input fields
- `browser_snapshot` — get the page accessibility tree
- `browser_evaluate` — run JavaScript in the browser
- `browser_fill_form` — fill form fields
- `browser_press_key` — press keyboard keys
- `browser_tabs` — list open tabs
- `browser_wait_for` — wait for an element
- `browser_close` — close the browser

To customize or disable:

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

Use `/mcp` to check server status and available tools.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

```
src/
├── entrypoints/
│   ├── cli.ts                  # CLI boot sequence, arg parsing, pipeline subcommands
│   └── daemon.ts               # Pipeline scheduler daemon
├── screens/REPL.tsx            # Ink-based interactive REPL
├── screens/readlineRepl.ts     # Fallback readline REPL
├── QueryEngine.ts              # Query orchestration
├── query.ts                    # Async generator query loop
├── Tool.ts                     # Tool interface + factory
├── tools.ts                    # Tool registry
├── commands.ts                 # 50 slash commands
├── providers/                  # LLM provider adapters (8 providers)
├── tools/                      # 35+ tool implementations
│   ├── BashTool/               # Shell execution with 6 security layers
│   ├── HttpRequestTool/        # Full HTTP client
│   ├── PipelineTool/           # Pipeline automation (5 tools)
│   ├── AgentTool/              # Subagent spawning
│   ├── TaskTools/              # Background task management (6 tools)
│   └── ...                     # 20+ more tool directories
├── services/
│   ├── pipeline/               # Pipeline engine
│   │   ├── types.ts            # Pipeline type definitions
│   │   ├── loader.ts           # YAML parsing & validation
│   │   ├── context.ts          # {{ }} interpolation engine
│   │   ├── executor.ts         # Stage orchestration via QueryEngine
│   │   ├── scheduler.ts        # Real cron executor (node-cron)
│   │   └── logger.ts           # JSONL run logging
│   ├── mcp/                    # MCP server management
│   ├── compact/                # Auto-compaction & microcompact
│   ├── browser/                # Built-in Playwright config
│   ├── tools/                  # StreamingToolExecutor
│   └── api/                    # Retry with exponential backoff
├── components/                 # 65+ Ink/React UI components
├── ink/hooks/                  # 14 React hooks
├── state/                      # AppStateStore + persistence
├── plugins/                    # Plugin loader system
├── themes/                     # 6 color themes
├── skills/                     # Skill loading from SKILL.md
├── utils/                      # Config, permissions, session, git, bash, sandbox
└── vim/                        # Vim mode (motions, operators, text objects)
```

## Development

```bash
npm install           # Install dependencies
npm start             # Run with tsx (no build needed)
npm run dev           # Watch mode
npm run build         # Build TypeScript to dist/
npm test              # Run all 772 tests
npm run typecheck     # Type check only
npx vitest run src/path/to/test.ts   # Run specific test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 135 |
| Test files | 34 |
| Source lines | 38,736 |
| Built-in tools | 35+ |
| Slash commands | 50 |
| React hooks | 14 |
| UI components | 65+ |
| LLM providers | 8 |
| Color themes | 6 |
| Tests | 772 passing |
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
- [node-cron](https://github.com/node-cron/node-cron) — Pipeline scheduling
- [yaml](https://github.com/eemeli/yaml) — Pipeline YAML parsing
