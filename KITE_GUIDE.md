# Kite Code — Complete Reference Guide

> This document is the single source of truth about Kite Code. It covers
> every feature, configuration option, command, tool, and workflow. When a
> user asks "how do I …?", the answer is here.

---

## 1. What Is Kite

Kite Code is an open-source, general-purpose AI assistant that runs in the
terminal. It connects to any LLM provider (Anthropic, OpenAI, Ollama, Groq,
DeepSeek, Mistral, OpenRouter, or any OpenAI-compatible endpoint) and gives
the AI access to 29 built-in tools — shell execution, file operations, web
search, web browsing, system monitoring, LSP diagnostics, MCP servers, and
more.

Kite is **not limited to coding**. It can:
- Search the web for real-time information (weather, news, prices, docs)
- Browse websites, take screenshots, fill forms, click buttons
- Run shell commands and automate system tasks
- Read, write, and edit files of any kind
- Analyze data, write documentation, answer questions
- Monitor system resources (CPU, memory, disk)
- Manage projects with task lists and planning
- Connect to external services via MCP servers

**Key principles:**
- Zero telemetry — no analytics, no tracking, nothing phones home.
- Zero OAuth — API keys via environment variables, no browser login.
- Any provider — not locked to a single vendor.
- Local config — `kite.config.json` replaces remote feature flags.
- Node.js 20+ — runs everywhere Node runs.

---

## 2. Installation

### From npm (recommended)

```bash
npm install -g @viditraj/kite-code
kite
```

### From source

```bash
git clone https://github.com/viditraj/kite-code.git
cd kite-code
npm install
npm run build
npm link          # makes the `kite` command available globally
kite
```

### Requirements

- **Node.js 20 or later** (check with `node --version`)
- An API key for your chosen LLM provider (not needed for Ollama)

---

## 3. First-Run Setup

On the very first launch, Kite shows an onboarding wizard:

1. **Theme** — choose from 6 color themes.
2. **Provider** — pick your LLM (Anthropic, OpenAI, Ollama, Groq, DeepSeek,
   Mistral, OpenRouter, or Custom / Self-Hosted).
3. **Model** — pick a model from the provider's list, or type a custom model
   name.
4. **Base URL** (custom providers only) — enter your endpoint URL.
5. **SSL verification** (custom providers only) — choose Yes (default) or No
   (for self-signed certificates).
6. **API key** — which environment variable holds your key (e.g.,
   `ANTHROPIC_API_KEY`).
7. **Confirmation** — review and save.

The result is saved to `kite.config.json` in the current directory and
`~/.kite/config.json` for the theme. The wizard runs only once.
Re-run it anytime with `kite --setup` or `/setup` inside the REPL.

---

## 4. Configuration

### 4.1 Config files

| File | Scope | What it stores |
|------|-------|---------------|
| `./kite.config.json` | Project | Provider, model, permissions, behavior |
| `~/.kite/config.json` | Global (user) | Theme, onboarding status, global overrides |
| `~/.kite/state.json` | Global (user) | Persisted UI preferences (vim mode, output style, etc.) |
| `.mcp.json` | Project | MCP server definitions |
| `.kite/mcp.json` | Project | Alternative MCP config location |

### 4.2 kite.config.json — full schema

```jsonc
{
  "provider": {
    "name": "anthropic",               // Provider name (see §4.3)
    "model": "claude-sonnet-4-20250514", // Model identifier
    "apiKeyEnv": "ANTHROPIC_API_KEY",   // Env var that holds the API key
    "apiBaseUrl": "",                    // Custom endpoint URL (empty = default)
    "verifySsl": true,                  // Set false for self-signed certs
    "contextLength": 200000,            // Context window size (auto-detected)
    "extraHeaders": {},                 // Additional HTTP headers
    "extraPayload": {}                  // Additional JSON fields in requests
  },
  "behavior": {
    "permissionMode": "default",        // default | acceptEdits | plan | bypassPermissions | dontAsk
    "maxTokens": 8192,                  // Max output tokens per response
    "maxCostUsd": null                  // Session cost cap in USD (null = no limit)
  },
  "features": {
    "vimMode": false,                   // Start in vim mode
    "memorySystem": true,               // Load AGENTS.md / CLAUDE.md
    "skills": true,                     // Load .kite/skills/
    "mcp": true,                        // Connect MCP servers
    "toolSearch": true                  // Enable deferred tool search
  },
  "permissions": {
    "allow": [],                        // Always-allow rules
    "ask": [],                          // Always-ask rules
    "deny": []                          // Always-deny rules
  }
}
```

### 4.3 Supported providers

| Name | API key env var | Default model | Base URL |
|------|----------------|---------------|----------|
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` | `https://api.anthropic.com` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o` | `https://api.openai.com` |
| `ollama` | _(none needed)_ | `llama3.1` | `http://localhost:11434` |
| `groq` | `GROQ_API_KEY` | `llama-3.1-70b-versatile` | `https://api.groq.com` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | `https://api.deepseek.com` |
| `mistral` | `MISTRAL_API_KEY` | `mistral-large-latest` | `https://api.mistral.ai` |
| `openrouter` | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-4-20250514` | `https://openrouter.ai` |
| `custom` | `KITE_API_KEY` | _(user-specified)_ | _(user-specified)_ |

Any OpenAI-compatible endpoint works as a custom provider. If the base URL
already ends with `/chat/completions`, Kite uses it as-is. Otherwise it
appends `/v1/chat/completions`.

### 4.4 Config loading priority (highest wins)

1. CLI flags (`--model`, `--provider`, etc.)
2. Project config (`./kite.config.json`, walks up the directory tree)
3. Global config (`~/.kite/config.json`)
4. Built-in defaults

### 4.5 Environment variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GROQ_API_KEY` | Groq API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `KITE_API_KEY` | Fallback API key for custom providers |
| `KITE_SANDBOX` | Set to `1` to enable sandboxed execution |
| `KITE_SANDBOX_LEVEL` | `basic` or `strict` (requires bubblewrap) |
| `KITE_STARTUP_TIMING` | Set to `1` to log startup time to stderr |
| `KITE_SHELL` | Override detected shell (for env display) |

---

## 5. CLI Flags

```
kite [options] [prompt]
```

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive: send prompt, print response, exit |
| `-c, --continue` | Resume the most recent conversation |
| `-r, --resume [id]` | Resume by session ID, or open interactive picker |
| `--model <model>` | Override model for this session |
| `--provider <name>` | Override provider name |
| `--permission-mode <mode>` | `default`, `acceptEdits`, `plan`, `bypassPermissions` |
| `--system-prompt <text>` | Replace the default system prompt entirely |
| `--append-system-prompt <text>` | Append text to the default system prompt |
| `--max-tokens <n>` | Max output tokens per response |
| `--max-budget-usd <n>` | Max session cost in USD |
| `--config <path>` | Path to a custom `kite.config.json` |
| `--allowed-tools <tools...>` | Whitelist specific tools |
| `--disallowed-tools <tools...>` | Blacklist specific tools |
| `--mcp-config <paths...>` | Additional MCP config files to load |
| `--doctor` | Run system diagnostics and exit |
| `--setup` | Launch the provider setup wizard |
| `-d, --debug [filter]` | Enable debug logging |
| `--verbose` | Verbose output |
| `--bare` | Minimal mode: skip hooks, plugins, auto-memory |

### Examples

```bash
kite                                    # Interactive REPL
kite -p "explain this error" < err.log  # Pipe input, print response, exit
kite --continue                         # Resume last session
kite --resume                           # Interactive session picker
kite --resume abc12345                   # Resume specific session
kite --resume "refactor auth"           # Search sessions by title
kite --model gpt-4o --provider openai   # Override model & provider
kite --doctor                           # System diagnostics
kite --setup                            # Reconfigure provider
```

---

## 6. Slash Commands (48 total)

Type `/` in the prompt to see autocomplete suggestions. Type `/help` for the
interactive command picker.

### Navigation & Config

| Command | Aliases | Args | Description |
|---------|---------|------|-------------|
| `/help` | `h`, `?` | — | Interactive command picker |
| `/model` | — | `[model]` | Show or switch AI model |
| `/provider` | — | `[name] [model]` | Show or switch provider |
| `/provider-settings` | `ps` | `[setting] [value]` | View/edit provider settings (name, model, apiBaseUrl, apiKeyEnv, verifySsl) |
| `/setup` | — | — | Launch full provider setup wizard |
| `/mode` | — | `[mode]` | Change permission mode |
| `/effort` | — | `[low\|medium\|high]` | Set response depth |
| `/theme` | — | `[name]` | Change color theme |
| `/output-style` | `style` | `[verbose\|concise\|brief]` | Set verbosity |
| `/thinking` | — | — | Toggle thinking/reasoning display |
| `/vim` | — | — | Toggle vim keybinding mode |
| `/fast` | — | — | Toggle fast mode |
| `/debug` | — | — | Toggle debug logging |
| `/verbose` | — | — | Toggle verbose output |
| `/login` | — | — | Show API key setup instructions |

### Session & Context

| Command | Aliases | Args | Description |
|---------|---------|------|-------------|
| `/context` | `tokens`, `ctx` | — | Token usage with visual bar |
| `/stats` | — | — | Session statistics |
| `/cost` | — | — | Cost breakdown |
| `/usage` | — | — | API usage totals |
| `/clear` | `reset`, `new` | — | Clear conversation |
| `/compact` | — | `[instructions]` | Summarize and compact context |
| `/rewind` | `undo` | — | Remove last user+assistant exchange |
| `/summary` | — | — | Ask the LLM to summarize conversation |
| `/rename` | — | `<name>` | Rename current session |
| `/export` | — | `[filename]` | Export conversation to markdown |
| `/resume` | — | `[session-id]` | Resume a previous session |
| `/session` | — | — | Show session info (uptime, PID, CWD) |
| `/copy` | — | — | Copy last response to clipboard |

### Tools & System

| Command | Aliases | Args | Description |
|---------|---------|------|-------------|
| `/config` | — | — | Show current configuration JSON |
| `/env` | — | — | Environment info (Node, platform, provider, git) |
| `/sandbox` | — | `[on\|off]` | Show/toggle sandbox mode |
| `/doctor` | — | — | System diagnostics |
| `/diff` | — | — | `git diff` output |
| `/branch` | — | `[name]` | Show/switch git branch |
| `/files` | — | — | `git status --short` |
| `/mcp` | — | — | MCP server status |
| `/skills` | — | — | List available skills |
| `/agents` | — | — | List agent types |
| `/tasks` | — | — | Show background tasks |
| `/hooks` | — | — | Show hook configuration info |
| `/status` | — | — | System status |
| `/keybindings` | — | — | Keyboard shortcuts |
| `/memory` | — | `[show]` | Show AGENTS.md / CLAUDE.md |
| `/review` | — | `[scope]` | Ask LLM to review code changes |
| `/feedback` | `issue` | `<text>` | Send feedback |
| `/release-notes` | — | — | Show release notes |
| `/permissions` | — | — | Show permission rules |
| `/plan` | — | — | Enter plan mode |
| `/exit` | `quit`, `q` | — | Exit Kite |

---

## 7. How to Change Provider Settings After Setup

### Method 1: `/provider-settings` command (recommended)

```
/provider-settings                                    # Show all settings
/provider-settings verifySsl false                    # Disable SSL verification
/provider-settings model gpt-4o                       # Change model
/provider-settings apiBaseUrl https://my-server/v1    # Change endpoint
/provider-settings apiKeyEnv MY_CUSTOM_KEY            # Change API key env var
/provider-settings name ollama                        # Change provider
```

Changes are saved to `kite.config.json` automatically. Restart Kite for
the new provider connection to take effect.

### Method 2: `/setup` command

Run `/setup` to re-launch the full provider setup wizard with all steps
including SSL verification.

### Method 3: Edit kite.config.json directly

```bash
# Edit the config file
nano kite.config.json
# Then restart Kite
```

### Method 4: CLI flags (session only)

```bash
kite --provider ollama --model llama3.1
```

---

## 8. Tools (29 built-in)

The AI uses these tools automatically during conversations. Tools that
modify files or run commands ask for permission first.

### File Operations

| Tool | Permission | What it does |
|------|-----------|--------------|
| **Bash** | Ask | Execute shell commands with streaming output, timeout handling, read-only detection |
| **Read** | Auto | Read file contents or list directories, with optional line offset/limit |
| **Write** | Ask | Create or overwrite files, auto-creates parent directories |
| **Edit** | Ask | Edit files by exact string replacement (`old_string` → `new_string`) |
| **Grep** | Auto | Search file contents with regex (uses ripgrep internally) |
| **Glob** | Auto | Find files by glob pattern (`*.ts`, `**/*.json`, etc.) |

### Web & Network

| Tool | Permission | What it does |
|------|-----------|--------------|
| **WebSearch** | Auto | Search the web via DuckDuckGo, with domain filtering |
| **WebFetch** | Auto | Fetch and extract content from URLs |

### Agent & Workflow

| Tool | Permission | What it does |
|------|-----------|--------------|
| **Agent** | Ask | Spawn a subagent with its own conversation loop for delegated tasks |
| **TodoWrite** | Auto | Manage the session task checklist (add/update/complete items) |
| **AskUserQuestion** | Auto | Present multiple-choice questions to the user |
| **EnterPlanMode** | Auto | Switch to plan mode (explore only, no modifications) |
| **ExitPlanMode** | Auto | Present a plan for approval and return to normal mode |
| **VerifyPlan** | Auto | Check that plan steps have been executed |

### Code Intelligence

| Tool | Permission | What it does |
|------|-----------|--------------|
| **LSP** | Auto | Run static analysis: TypeScript (tsc), Python (py_compile), JavaScript (node --check), Rust (cargo check) |
| **NotebookEdit** | Ask | Edit Jupyter notebook cells (replace, insert, delete) |

### MCP & Extensions

| Tool | Permission | What it does |
|------|-----------|--------------|
| **MCPTool** | Ask | Call tools on connected MCP servers |
| **ListMcpResources** | Auto | List resources from MCP servers |
| **ReadMcpResource** | Auto | Read a specific MCP resource |
| **Skill** | Auto | Execute a custom skill from `.kite/skills/` |
| **ToolSearch** | Auto | Search for deferred tools by keyword |

### System & Utilities

| Tool | Permission | What it does |
|------|-----------|--------------|
| **Monitor** | Auto | Report system metrics (CPU, memory, disk) |
| **Config** | Auto | Read/write `kite.config.json` |
| **PowerShell** | Ask | Execute PowerShell commands (Windows) |
| **Sleep** | Auto | Delay execution (max 5 minutes) |
| **SendMessage** | Auto | Send messages for inter-agent communication |
| **ScheduleCron** | Auto | Create/list/delete cron-like scheduled tasks |
| **WorktreeTool** | Ask | Create/remove git worktrees |
| **SyntheticOutput** | Auto | Format content as text, JSON, or markdown |

### Permission levels

- **Auto** — tool runs without asking.
- **Ask** — Kite shows a permission dialog: Allow (y), Always allow (a), Deny (n).
- "Always allow" persists for the rest of the session.

---

## 9. Permission Modes

Set with `--permission-mode`, `/mode`, or in `kite.config.json`:

| Mode | Behavior |
|------|----------|
| `default` | Ask before running write tools (Bash, Write, Edit, Agent, etc.) |
| `acceptEdits` | Auto-accept file edits (Write, Edit), still ask for Bash |
| `plan` | Explore only — all write tools are blocked |
| `bypassPermissions` | Allow everything without asking |
| `dontAsk` | Never show permission prompts — deny anything that would ask |

---

## 10. Sessions

### How sessions work

Every conversation is automatically saved to `~/.kite/sessions/` in JSONL
format (one JSON object per line). The first line is metadata (id, title,
model, cwd, timestamps), subsequent lines are messages.

Session titles are auto-generated from the first user message.

### Resume a session

```bash
kite --continue                  # Resume most recent session
kite --resume                    # Interactive picker with search
kite --resume abc12345           # Resume by session ID
kite --resume "refactor auth"    # Search by title
```

Or inside the REPL:

```
/resume                          # List recent sessions
/resume abc12345                 # Resume by ID
```

### Manage sessions

```
/rename my new session title     # Rename current session
/export conversation.md          # Export to markdown file
/session                         # Show session info
/stats                           # Detailed statistics
```

### Session storage

- Location: `~/.kite/sessions/`
- Format: JSONL (`.jsonl` files)
- Markdown exports: `.md` files alongside JSONL
- Auto-cleanup: sessions older than 30 days are cleaned up
- Max stored: 100 sessions

---

## 11. Themes

Six built-in themes. Switch with `/theme` or set in `~/.kite/config.json`:

| Theme | Description |
|-------|-------------|
| `dark` | Default — cyan/magenta on dark background |
| `light` | Blue/magenta on light background |
| `dark-colorblind` | Deuteranopia-friendly (orange/blue) |
| `light-colorblind` | Light variant of colorblind theme |
| `dark-ansi` | Basic 8 ANSI colors only |
| `light-ansi` | Light ANSI variant |

---

## 12. MCP (Model Context Protocol)

### Built-in browser

Kite includes a built-in Playwright MCP server that provides browser tools
(navigate, screenshot, click, type, etc.). It starts automatically — no
configuration needed.

Available browser tools (prefixed with `mcp__playwright__`):
`browser_navigate`, `browser_take_screenshot`, `browser_click`,
`browser_type`, `browser_snapshot`, `browser_close`, `browser_evaluate`,
`browser_fill_form`, `browser_press_key`, `browser_tabs`, `browser_wait_for`.

### Add MCP servers

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

Environment variables in MCP configs support `${VAR}`, `$VAR`, and
`${VAR:-default}` syntax.

### MCP config loading priority (highest wins)

1. Local: `.kite/mcp.json` or `kite.config.json` `mcpServers` section
2. Project: `.mcp.json` (walks up directory tree)
3. User: `~/.kite/config.json` `mcpServers` section
4. Built-in: Playwright browser server

### Override the built-in browser

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

### Disable the browser

```json
{
  "mcpServers": {
    "playwright": {
      "disabled": true
    }
  }
}
```

### Check MCP status

```
/mcp
```

---

## 13. Skills

Skills are markdown-based command extensions. They let you create reusable
prompts that the AI can invoke as slash commands.

### Create a skill

```
.kite/skills/deploy/SKILL.md
```

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

### Use a skill

```
/deploy production
```

### Skill metadata (frontmatter)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill name (matches folder name) |
| `description` | string | Shown in `/skills` listing |
| `arguments` | string[] | Named placeholders |
| `allowedTools` | string[] | Tools the skill can use |
| `model` | string | Override model for this skill |
| `context` | `inline` \| `fork` | Run inline or in a forked agent |
| `agent` | string | Agent type to use |
| `paths` | string[] | File paths to include as context |

### Skill directories

Skills are loaded from:
- `.kite/skills/` (project level)
- `.claude/skills/` (compatibility)
- `~/.kite/skills/` (global)

---

## 14. Plugins

Plugins extend Kite with custom tools, commands, and lifecycle hooks.

### Plugin structure

```
.kite/plugins/my-plugin/
  plugin.json           # Manifest (required)
  tools/myTool.js       # Tool modules
  commands/myCmd.js      # Command modules
  hooks/onStart.js       # Hook handlers
```

### Plugin manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "tools": ["./tools/myTool.js"],
  "commands": ["./commands/myCmd.js"],
  "hooks": {
    "onSessionStart": "./hooks/onStart.js"
  },
  "disabled": false
}
```

### Plugin directories

- Project: `.kite/plugins/` (takes precedence)
- Global: `~/.kite/plugins/`

### Disable a plugin

Set `"disabled": true` in the plugin's `plugin.json`.

---

## 15. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Cancel running request / Exit (when idle) |
| `Escape` | Cancel running request |
| `Ctrl+A` | Move cursor to start of line |
| `Ctrl+E` | Move cursor to end of line |
| `Ctrl+U` | Clear entire line |
| `Ctrl+K` | Kill text from cursor to end of line |
| `Ctrl+W` | Delete word before cursor |
| `Up/Down` | Navigate input history |
| `Tab` | Accept autocomplete suggestion |
| `/` | Start typing to see command autocomplete |

### Vim mode (`/vim`)

When vim mode is enabled:
- `i` — insert mode
- `Escape` — normal mode
- `h/j/k/l` — movement
- `w/b` — word movement
- `0/$` — line start/end
- `x` — delete character
- `dd` — delete line
- `yy` — yank line
- `p/P` — paste after/before
- `v` — visual mode
- `a/A` — append after cursor / end of line
- `o` — open line below
- `I` — insert at line start

---

## 16. Auto-Compaction

When the conversation approaches the model's context window limit, Kite
automatically compacts old messages to free space.

**How it works:**

1. Before each LLM call, Kite estimates the total token count.
2. If usage exceeds **75%** of the context window, compaction triggers.
3. **Stage 1 — MicroCompact** (free, no LLM call): truncate large tool
   results (>30k chars) and text blocks (>50k chars).
4. **Stage 2 — Full Compact** (LLM call): summarize old messages while
   preserving the 4 most recent messages. Never splits tool_use/tool_result
   pairs.
5. At **95%** usage, the query loop refuses to send (blocking limit).

You can also manually compact with `/compact [custom instructions]`.

---

## 17. Sandbox Mode

Kite can run shell commands in a sandboxed environment using
[bubblewrap](https://github.com/containers/bubblewrap) (`bwrap`).

### Enable

```bash
export KITE_SANDBOX=1
kite
```

Or inside the REPL:

```
/sandbox on
```

### Security levels

| Level | Description |
|-------|-------------|
| `none` | No sandboxing (default) |
| `basic` | Read-only root FS, writable CWD, isolated /dev/proc/tmp |
| `strict` | Basic + network isolation |

Set with `KITE_SANDBOX_LEVEL=strict`.

### Requirements

Install bubblewrap: `sudo apt install bubblewrap` (Linux only).

---

## 18. Non-Interactive Mode

Use `-p` / `--print` to send a prompt and get the response on stdout:

```bash
kite -p "explain this function" < myfile.ts
kite -p "list all TODO comments in this project"
echo "fix the bug in main.ts" | kite -p
```

The AI can still use tools (Bash, file read/write, etc.) in non-interactive
mode. Permission prompts are suppressed — tools that require permission are
denied automatically.

---

## 19. System Diagnostics

```bash
kite --doctor
```

Or inside the REPL:

```
/doctor
```

Checks:
- Node.js version
- Platform and architecture
- Working directory
- Config file location and contents
- API key status (set / not set)
- Provider connectivity (sends a test request)

---

## 20. Troubleshooting

### "Connection failed: fetch failed"

Your API key is missing or the endpoint is unreachable.

**Fix:** Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or check your provider settings:
```
/provider-settings
/env
```

### SSL certificate errors with custom providers

**Fix:**
```
/provider-settings verifySsl false
```

Or in `kite.config.json`:
```json
{
  "provider": {
    "verifySsl": false
  }
}
```

### "No configuration loaded"

The config isn't stored in the engine's state. Run `/setup` to configure,
or manually create `kite.config.json`.

### Kite doesn't start (not a TTY)

If the terminal isn't detected as a TTY, Kite falls back to a simpler
readline REPL. This is normal for piped input or some terminal emulators.

### Context window full

The conversation is too long. Options:
- `/compact` — manually compact the conversation
- `/clear` — start fresh
- Auto-compaction kicks in at 75% (see §16)

### MCP server won't connect

```
/mcp
```

Check that the server command is correct in `.mcp.json` and any required
environment variables are set.

### Changing model or provider mid-session

Use `/model <model>` or `/provider <name>` to switch. Changes take effect
on the next query. For full reconfiguration including SSL and base URL,
use `/setup` or `/provider-settings`.

---

## 21. File Locations Summary

| Path | Purpose |
|------|---------|
| `./kite.config.json` | Project configuration |
| `~/.kite/config.json` | Global user configuration (theme, onboarding) |
| `~/.kite/state.json` | Persisted UI state (vim mode, output style) |
| `~/.kite/sessions/` | Saved conversations (JSONL format) |
| `~/.kite/snapshots/` | File history backups (per session) |
| `~/.kite/plugins/` | Global plugins |
| `.kite/plugins/` | Project plugins |
| `.kite/skills/` | Project skills |
| `.kite/mcp.json` | Local MCP server config |
| `.mcp.json` | Project MCP server config |
| `AGENTS.md` | Project memory file (loaded into system prompt) |
| `CLAUDE.md` | Alternative memory file (compatibility) |

---

## 22. Token Usage & Cost Tracking

### Check usage

```
/context         # Visual bar + breakdown
/cost            # Cost summary with cache tokens
/usage           # Simple totals
/stats           # Full session statistics
```

### Status bar

The bottom status bar always shows:
- Current model name
- Git branch (if in a repo)
- Token count and context percentage
- Message count

### Color coding

- **Green**: <50% context used
- **Yellow**: 50-80% context used
- **Red**: >80% context used

---

## 23. Memory System (AGENTS.md)

Kite loads `AGENTS.md` (or `CLAUDE.md`) from the project root into the
system prompt. Use it to give the AI project-specific context:

```markdown
# AGENTS.md

## Build Commands
- `npm run build` — compile TypeScript
- `npm test` — run tests

## Code Style
- Use single quotes
- 2-space indentation

## Project Notes
- The auth module is in src/auth/
- Never modify the migration files directly
```

View with `/memory`. The file is loaded once at startup.

---

## 24. Cost Estimation

Kite tracks token usage per session. Built-in pricing for common models:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| claude-sonnet-4-20250514 | $3.00 | $15.00 |
| claude-opus-4-20250514 | $15.00 | $75.00 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| deepseek-chat | $0.14 | $0.28 |

Set a budget cap:
```bash
kite --max-budget-usd 5.00
```

---

## 25. Version & Updates

Check version:
```bash
kite --version
```

Update:
```bash
npm install -g @viditraj/kite-code@latest
```
