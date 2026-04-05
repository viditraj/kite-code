# Kite Code — Implementation Plan

## Current State
- **221 source files**, **51,936 lines**
- **29 tools**, **48 commands**, **14 hooks**, **70+ components**
- **0 TypeScript errors**, **692 tests passing**

---

## Phase 1: Critical UX ✅ COMPLETE

### 1.1 Auto-Compact on Context Limit ✅
- `query.ts` checks estimated token count before each LLM call
- Two-stage compaction: microcompact (free) + full LLM compaction
- `autoCompact.ts` with 75% compact threshold, 95% blocking threshold
- Reactive compaction on max_tokens recovery

### 1.2 Session Save/Resume ✅
- JSONL storage in `~/.kite/sessions/` with metadata + messages
- `--continue` / `--resume [id]` CLI flags
- `/resume` command with interactive session picker
- Auto-saves messages after each turn, auto-generates titles
- Markdown export, search by title, cleanup of old sessions

### 1.3 Token Budget in Status Bar ✅
- Cumulative token tracking from provider events
- StatusBar shows `Xk/128k tokens (Y%)` with color coding
- `/context` command shows detailed breakdown with visual bar
- Token budget tracker with continuation decision logic

### 1.4 File History Snapshots ✅
- Content-hash-based dedup in `~/.kite/snapshots/`
- `backupFileBeforeEdit()` called before file modifications
- `restoreFile()` for undo support
- `/rewind` command removes last user+assistant exchange

---

## Phase 2: Commands & Polish ✅ COMPLETE

### 2.1 New Slash Commands ✅
All 10 commands implemented:
- `/context` ✅ — token usage breakdown with visual bar
- `/stats` ✅ — session statistics
- `/effort` ✅ — set model effort level
- `/env` ✅ — environment information
- `/rewind` ✅ — undo last exchange
- `/summary` ✅ — LLM conversation summary
- `/rename` ✅ — rename current session
- `/sandbox` ✅ — toggle sandbox mode
- `/login` ✅ — configure API key
- `/output-style` ✅ — set verbosity

### 2.2 Message Timestamps ✅
- `MessageTimestamp` component with relative time formatting
- Rendered next to "You" and "Kite" labels in MessageRow
- Auto-updates every 30 seconds via useInterval

### 2.3 Git Operations Tracking ✅
- Git branch detected on startup, shown in status bar
- Git utilities: branch, SHA, status, diff, log, worktree detection
- Cached with 10-second TTL to avoid excessive git calls

### 2.4 Rich /help v2 ✅
- `HelpV2` component with categorized command display
- Interactive arrow-key picker for all commands
- Vim-like navigation (j/k, g/G, Ctrl+U/D)

---

## Phase 3: Advanced Features ✅ COMPLETE

### 3.1 Command Autocomplete ✅
- Fuzzy matching of command names, aliases, and descriptions
- Dropdown rendered inline below the prompt when user types `/`
- Arrow-key navigation, Tab to apply, Enter to submit, Escape to dismiss
- Ghost text for inline completion (dimmed suffix)

### 3.2 Useful Hooks ✅
All 10 hooks implemented:
- `useElapsedTime` ✅ — formatted elapsed time via useSyncExternalStore
- `useHistorySearch` ✅ — Ctrl+R incremental search through history
- `useDoublePress` ✅ — rapid double-press detection (800ms window)
- `useMinDisplayTime` ✅ — throttle values for minimum visibility duration
- `useTimeout` ✅ — setTimeout with auto-cleanup
- `useAfterFirstRender` ✅ — callback after component mount
- `useMemoryUsage` ✅ — Node.js heap monitoring with status thresholds
- `useCopyOnSelect` ✅ — auto-copy to system clipboard
- `usePasteHandler` ✅ — paste detection with image path handling
- `useCancelRequest` ✅ — unified Escape/Ctrl+C cancel handler

### 3.3 Extended Bash Security ✅
6 validation layers, all implemented and tested:
- `bashSecurity.ts` — 23 security checks
- `bashPermissions.ts` — permission engine with rule matching
- `readOnlyValidation.ts` — flag-based read-only detection
- `pathValidation.ts` — dangerous path detection
- `sedValidation.ts` — sed command safety analysis
- `modeValidation.ts` — permission mode overrides

### 3.4 MCP Enhancements ✅
- MCP server management (stdio/SSE/HTTP transports)
- Server approval dialog component
- ListMcpResources / ReadMcpResource tools
- `/mcp` command for server status
- Built-in Playwright MCP server for browser access

---

## Phase 4: UI Components ✅ COMPLETE

### 4.1 Message Rendering Components ✅
All implemented: FilePathLink, CompactSummary, TokenWarning, MessageTimestamp, InterruptedByUser

### 4.2 Permission Dialogs ✅
All implemented: BashPermissionRequest, FileWritePermissionRequest, FileEditPermissionRequest, WebFetchPermissionRequest, MCPServerApprovalDialog

### 4.3 Feature Components ✅
All implemented: ContextVisualization, SessionPreview, HistorySearchDialog, OutputStylePicker, QuickOpenDialog

---

## Phase 5: Infrastructure ✅ COMPLETE

### 5.1 State Management ✅
- `Store<T>` — immutable store with getState/setState/subscribe
- `AppStateStore` — typed global state (provider, session, permissions, tokens, MCP, tasks, UI toggles, git)
- `AppStateProvider` — React context with useAppState(selector), useSetAppState()
- Disk persistence to `~/.kite/state.json` with debounced auto-save

### 5.2 Extended Git Integration ✅
- Git utilities (findGitRoot, getGitBranch, getGitStatus, getGitDiff, etc.)
- Branch tracking in status bar
- File history snapshots per session

### 5.3 Plugin System ✅
- Plugin discovery from `.kite/plugins/` (project) and `~/.kite/plugins/` (global)
- `plugin.json` manifest format (name, version, description, tools, commands, hooks)
- Dynamic ESM module loading for tool, command, and hook modules
- `executePluginHook()` for lifecycle events
- Plugin cache management and error collection

---

## What NOT to Implement (Anthropic-Specific)
- OAuth/login (Anthropic Console)
- Voice mode (speech APIs)
- Desktop handoff (Anthropic desktop app)
- Chrome extension integration
- Plugin marketplace (Anthropic ecosystem)
- Rate limit management (Anthropic billing)
- Team/enterprise features
- Telemetry/analytics (intentionally zero-telemetry)
- Auto-updater (Anthropic update server)
- Remote sessions (Anthropic cloud compute)
