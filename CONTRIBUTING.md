# Contributing to Kite Code

Thank you for your interest in contributing to Kite Code! This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- **Node.js 20+** — [install](https://nodejs.org/)
- **Git** — [install](https://git-scm.com/)

### Getting Started

```bash
git clone https://github.com/kite-code/kite-code.git
cd kite-code
npm install
```

### Running in Development

```bash
# Run directly with tsx (no build step needed)
npm start

# Run with file watching (auto-restart on changes)
npm run dev

# Run with a prompt
npm start -- -p "hello"

# Run with debug logging
npm start -- --debug
```

### Building

```bash
npm run build        # Compile TypeScript to dist/
npm run typecheck    # Type-check without emitting
```

### Testing

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npx vitest run src/path/to/test.ts   # Run a specific test file
npx vitest run -t "test name"        # Run tests matching a pattern
```

All tests use [Vitest](https://vitest.dev/). Test files live next to the code they test (e.g., `src/tools/tools.test.ts`).

## Project Structure

```
src/
├── entrypoints/       # CLI entry point
├── screens/           # REPL screens (Ink + readline fallback)
├── components/        # React/Ink UI components
│   ├── messages/      # Message rendering (user, assistant, system, tool)
│   ├── permissions/   # Permission request dialogs
│   ├── design-system/ # Primitive components (Dialog, Pane, Tabs, etc.)
│   ├── PromptInput/   # Input with autocomplete
│   └── ...
├── ink/hooks/         # React hooks
├── providers/         # LLM provider adapters
├── tools/             # Tool implementations (one directory per tool)
├── services/          # MCP, compaction, retry, browser
├── state/             # AppStateStore, persistence, context
├── plugins/           # Plugin loader
├── skills/            # Skill loading from SKILL.md files
├── themes/            # Color themes
├── utils/             # Shared utilities
│   ├── bash/          # Bash AST parsing, command splitting
│   ├── permissions/   # Permission engine
│   ├── suggestions/   # Command autocomplete
│   ├── git/           # Git operations
│   ├── sandbox/       # Sandbox (bwrap) management
│   └── ...
├── vim/               # Vim mode (motions, operators, text objects)
├── query/             # Token budget, query deps
├── constants/         # System prompts
├── bootstrap/         # Tool and MCP bootstrapping
└── memdir/            # In-memory directory abstraction
```

## Code Style

### General

- **TypeScript** with strict mode. Zero `any` unless absolutely necessary.
- **ESM-only** — use `.js` extensions in imports (TypeScript resolves `.ts` files from `.js` imports).
- Follow existing patterns. Read neighboring files before writing new code.
- No placeholder code. Every function must be fully implemented.

### Naming

- Files: `camelCase.ts` for modules, `PascalCase.tsx` for React components
- Exports: `PascalCase` for components/classes/types, `camelCase` for functions/variables
- Test files: `*.test.ts` next to the module they test

### Comments

- Don't add or remove comments unless specifically needed.
- Each file should have a JSDoc header explaining its purpose and how it relates to Claude Code.

### Formatting

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line constructs
- No semicolons (configured in tsconfig)

## Adding a New Tool

1. Create `src/tools/MyTool/MyTool.ts`
2. Implement the `Tool` interface from `src/Tool.ts`
3. Register it in `src/bootstrap/tools.ts`
4. Add tests in `src/tools/MyTool/MyTool.test.ts`
5. Update the tool count in README.md

```typescript
import { buildTool } from '../../Tool.js'

export const MyTool = buildTool({
  name: 'MyTool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object' as const,
    properties: {
      param: { type: 'string', description: 'Description' },
    },
    required: ['param'],
  },
  isReadOnly: false,
  async call(input, context) {
    // Implementation
    return [{ type: 'text', text: 'result' }]
  },
})
```

## Adding a New Command

Add to the `createBuiltinCommands()` array in `src/commands.ts`:

```typescript
{
  type: 'local',
  name: 'mycommand',
  description: 'What it does',
  aliases: ['mc'],
  supportsNonInteractive: true,
  async call(args, context) {
    return { type: 'text', value: 'Output here' }
  },
},
```

## Adding a New Hook

1. Create `src/ink/hooks/useMyHook.ts`
2. Export from `src/ink/index.ts`
3. Add tests
4. Reference Claude Code's equivalent hook in the JSDoc header

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes with tests
3. Ensure everything passes: `npm run typecheck && npm run build && npm test`
4. Write a clear commit message explaining *why* (not just *what*)
5. Open a PR with:
   - Summary of changes
   - Test plan (how to verify)
   - Screenshots if UI changes

## Architecture Decisions

- **Ink over raw ANSI:** We use Ink (React for CLIs) because it gives us component composition, state management, and efficient terminal rendering for free.
- **Async generator query loop:** The main loop in `query.ts` yields events instead of returning a single response. This enables streaming, cancellation, and recovery without callback hell.
- **Per-tool permissions:** Each tool declares whether it needs permission. The REPL handles the prompt UI; the query loop just checks allow/deny.
- **Session persistence as JSONL:** One JSON object per line. First line is metadata, subsequent lines are messages. Easy to append, easy to tail, easy to debug.
- **Plugin system:** ESM dynamic import for maximum compatibility. Plugins can add tools, commands, and lifecycle hooks.

## Reference

This project studies [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic and implements equivalent functionality as an open-source, provider-agnostic alternative. When implementing features, always read the Claude Code source first to understand the original design, then adapt for Kite's architecture.
