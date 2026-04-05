/**
 * Readline-based REPL — works without Ink/React.
 *
 * This is the fallback REPL for non-TTY environments.
 * It provides the complete agent loop using the QueryEngine:
 *   user input → slash commands or QueryEngine → streaming display → repeat
 *
 * Key differences from Sprint 0 version:
 * - Uses QueryEngine (not raw provider.chat) for proper tool execution
 * - Sends tool schemas to LLM so it uses tool_use protocol (not text descriptions)
 * - Hides thinking text (only shows assistant text + tool results)
 * - Uses the command registry for slash commands
 * - Proper output formatting with clear separators
 */

import { createInterface, type Interface } from 'readline'
import chalk from 'chalk'
import type { LLMProvider, UnifiedMessage, ContentBlock } from '../providers/types.js'
import type { KiteConfig } from '../utils/config.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { QueryEngine } from '../QueryEngine.js'
import type { QueryEvent, Terminal } from '../query/deps.js'
import { getAllBaseTools } from '../tools.js'
import { createEmptyToolPermissionContext } from '../types/permissions.js'
import type { ToolPermissionContext } from '../types/permissions.js'
import { findCommand, executeCommand, getCommands } from '../commands.js'
import type { LocalCommandContext } from '../types/command.js'
import { bootstrapMCPTools, shutdownMCP } from '../bootstrap/mcp.js'

const KITE_LOGO = `
${chalk.cyan('  ╱╲')}
${chalk.cyan(' ╱  ╲')}
${chalk.cyan('╱ ◆◆ ╲')}  ${chalk.bold.cyan('Kite')} ${chalk.dim('v0.1.0')}
${chalk.cyan('╲  ╲╱  ╲')}
${chalk.cyan(' ╲    ╱')}  ${chalk.dim('/help for commands')}
${chalk.cyan('  ╲  ╱')}   ${chalk.dim('Ctrl+C to cancel, Ctrl+D to exit')}
${chalk.cyan('   ╲╱')}
`

export async function createReadlineRepl(
  provider: LLMProvider,
  config: KiteConfig,
  initialPrompt: string | undefined,
  options: Record<string, unknown>,
): Promise<void> {
  // Build system prompt with tool names (start with built-in, update after MCP)
  let tools = getAllBaseTools()
  let toolNames = tools.map(t => t.name)
  const systemPrompt = (options.systemPrompt as string) || getSystemPrompt(
    config.provider.model,
    toolNames,
  )

  // Build permission context
  const permissionContext: ToolPermissionContext = {
    ...createEmptyToolPermissionContext(),
    mode: (config.behavior.permissionMode as ToolPermissionContext['mode']) ?? 'default',
  }

  // Create QueryEngine — this handles the full agent loop with tool execution
  const engine = new QueryEngine({
    provider,
    tools,
    model: config.provider.model,
    maxTokens: config.behavior.maxTokens,
    systemPrompt,
    cwd: process.cwd(),
    debug: !!options.debug,
    verbose: !!options.verbose,
    permissionContext,
  })

  // Store provider in app state for AgentTool/WebSearchTool
  engine['appState']._provider = provider
  engine['appState']._permissionContext = permissionContext
  engine['appState']._config = config

  // Connect MCP servers in the background (don't block REPL startup)
  bootstrapMCPTools(process.cwd(), {
    onConnection: (serverName, status, toolCount) => {
      if (status === 'connected') {
        console.log(chalk.dim(`  MCP: ${serverName} connected (${toolCount} tools)`))
      }
    },
  }).then(({ tools: mergedTools, mcpToolCount }) => {
    if (mcpToolCount > 0) {
      tools = mergedTools
      toolNames = tools.map(t => t.name)
      engine.setTools(tools)
      console.log(chalk.dim(`  MCP: ${mcpToolCount} additional tools loaded`))
      console.log()
    }
  }).catch(() => {
    // Non-fatal — continue with built-in tools
  })

  // Show welcome screen (matches Claude Code's welcome)
  const user = process.env.USER || process.env.USERNAME || ''
  console.log(KITE_LOGO)
  console.log(chalk.dim('─'.repeat(60)))
  console.log()
  console.log(`  ${chalk.bold('Model:')}    ${chalk.cyan(config.provider.model)}`)
  console.log(`  ${chalk.bold('Provider:')} ${chalk.dim(config.provider.name)}`)
  console.log(`  ${chalk.bold('CWD:')}      ${chalk.dim(process.cwd())}`)
  console.log(`  ${chalk.bold('Tools:')}    ${chalk.dim(toolNames.length.toString())} available`)
  console.log(`  ${chalk.bold('Mode:')}     ${chalk.dim(config.behavior.permissionMode)}`)
  console.log()
  console.log(chalk.dim('─'.repeat(60)))
  console.log()
  console.log(chalk.dim('  Tips:'))
  console.log(chalk.dim('  • Ask me to write, edit, or debug code'))
  console.log(chalk.dim('  • I can search files, run commands, and more'))
  console.log(chalk.dim('  • Use /help to see all available commands'))
  console.log(chalk.dim('  • Use /compact to free up context space'))
  console.log()

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('❯ '),
    terminal: process.stdin.isTTY ?? false,
  })

  // Handle initial prompt if provided
  if (initialPrompt) {
    await handleUserInput(initialPrompt, engine, config)
  }

  rl.prompt()

  rl.on('line', async (line: string) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    // Pause readline during async operations to prevent output mixing
    rl.pause()

    // Slash command interception via command registry
    if (input.startsWith('/')) {
      await handleSlashCommand(input, config, engine, rl)
      rl.resume()
      rl.prompt()
      return
    }

    await handleUserInput(input, engine, config)
    rl.resume()
    rl.prompt()
  })

  rl.on('close', async () => {
    console.log(chalk.dim('\nGoodbye.'))
    await shutdownMCP()
    process.exit(0)
  })
}

// ============================================================================
// User input handling via QueryEngine
// ============================================================================

async function handleUserInput(
  input: string,
  engine: QueryEngine,
  config: KiteConfig,
): Promise<void> {
  let currentAssistantText = ''
  let lastEventWasText = false
  let turnIndex = 0

  // Show user message echo
  console.log()
  console.log(chalk.green.bold('You: ') + chalk.dim(input.length > 120 ? input.slice(0, 120) + '...' : input))
  console.log()

  try {
    const gen = engine.run(input)
    let result = await gen.next()

    while (!result.done) {
      const event = result.value

      switch (event.type) {
        case 'text_delta':
          if (!lastEventWasText && turnIndex > 0) {
            // New assistant text after tool results — add separator
            console.log()
          }
          process.stdout.write(event.text)
          currentAssistantText += event.text
          lastEventWasText = true
          break

        case 'thinking_delta':
          // Hidden — Claude Code doesn't show thinking to user
          break

        case 'tool_use_start': {
          if (lastEventWasText) {
            process.stdout.write('\n')
            lastEventWasText = false
          }
          break
        }

        case 'tool_result': {
          const e = event as any
          const toolName = e.toolName ?? e.result?.toolName ?? 'tool'
          const output = String(e.output ?? e.result?.output ?? '')
          const isError = e.isError ?? e.result?.isError ?? false

          // Display tool execution with clear formatting
          console.log()
          console.log(chalk.yellow(`  ⚙ ${toolName}`))

          if (isError) {
            console.log(chalk.red(`  ✗ Error: ${output.slice(0, 500)}`))
          } else if (output.length > 0) {
            // Show tool output with indentation and truncation
            const lines = output.split('\n')
            const maxLines = 20
            const displayLines = lines.length > maxLines
              ? [...lines.slice(0, maxLines), chalk.dim(`  ... (${lines.length - maxLines} more lines)`)]
              : lines
            for (const line of displayLines) {
              console.log(chalk.dim(`  ${line}`))
            }
          }
          console.log()
          break
        }

        case 'turn_start':
          currentAssistantText = ''
          lastEventWasText = false
          turnIndex++
          break

        case 'turn_complete':
          if (lastEventWasText) {
            process.stdout.write('\n')
            lastEventWasText = false
          }
          break

        case 'error': {
          const errorEvent = event as any
          console.log()
          console.error(chalk.red(`Error: ${errorEvent.message}`))
          break
        }

        case 'recovery': {
          const recoveryEvent = event as any
          console.log(chalk.yellow(`  ↻ ${recoveryEvent.reason}`))
          break
        }

        case 'max_turns_reached':
          console.log()
          console.log(chalk.yellow('⚠ Maximum turns reached.'))
          break
      }

      result = await gen.next()
    }

    // Ensure trailing newline
    if (lastEventWasText) {
      process.stdout.write('\n')
    }

    // Add separator after response
    console.log()

  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error(chalk.red(`\nError: ${(err as Error).message}`))
    }
  }
}

// ============================================================================
// Slash command handling via command registry
// ============================================================================

async function handleSlashCommand(
  input: string,
  config: KiteConfig,
  engine: QueryEngine,
  rl: Interface,
): Promise<void> {
  const parts = input.slice(1).split(/\s+/)
  const cmdName = parts[0]?.toLowerCase() ?? ''
  const args = parts.slice(1).join(' ')

  // Special handling for help — show all registered commands
  if (cmdName === 'help' || cmdName === 'h' || cmdName === '?') {
    const cmds = getCommands().filter(c => !c.isHidden && (c.isEnabled?.() ?? true))
    console.log()
    console.log(chalk.bold.cyan('  Available Commands'))
    console.log(chalk.dim('  ' + '─'.repeat(56)))
    for (const c of cmds) {
      const name = chalk.cyan(`/${c.name}`)
      const hint = c.argumentHint ? chalk.dim(` ${c.argumentHint}`) : ''
      const aliases = c.aliases?.length ? chalk.dim(` (${c.aliases.map(a => '/' + a).join(', ')})`) : ''
      const desc = chalk.dim(c.description)
      console.log(`  ${name}${hint}${aliases}`)
      console.log(`    ${desc}`)
    }
    console.log()
    return
  }

  // Special handling for exit
  if (cmdName === 'exit' || cmdName === 'quit' || cmdName === 'q') {
    rl.close()
    return
  }

  // Special handling for clear
  if (cmdName === 'clear' || cmdName === 'cls' || cmdName === 'reset' || cmdName === 'new') {
    engine.clearConversation()
    console.clear()
    console.log(chalk.dim('Conversation cleared.'))
    return
  }

  // Try command registry
  const cmd = findCommand(cmdName)
  if (cmd) {
    try {
      const ctx = buildCommandContext(engine, config)
      const result = await executeCommand(cmdName, args, ctx)
      if (result && result.type === 'text') {
        console.log()
        // Indent multi-line output
        const lines = result.value.split('\n')
        for (const line of lines) {
          console.log(`  ${line}`)
        }
        console.log()
      } else if (result && result.type === 'compact') {
        console.log()
        console.log(`  ${(result as any).displayText ?? 'Conversation compacted.'}`)
        console.log()
      }
    } catch (err) {
      console.log(chalk.red(`  Command error: ${(err as Error).message}`))
    }
    return
  }

  console.log(chalk.yellow(`Unknown command: /${cmdName}. Type /help for available commands.`))
}

// ============================================================================
// Build command context from engine state
// ============================================================================

function buildCommandContext(engine: QueryEngine, config: KiteConfig): LocalCommandContext {
  return {
    abortController: new AbortController(),
    options: {
      tools: engine['tools'] ?? [],
      commands: [],
      debug: false,
      verbose: false,
      mainLoopModel: config.provider.model,
      isNonInteractiveSession: false,
    },
    messages: engine.getConversation() as unknown[],
    getCwd: () => process.cwd(),
    getAppState: () => engine['appState'],
    setAppState: (f) => { engine['appState'] = f(engine['appState']) },
    readFileState: { has: () => false, get: () => undefined, set: () => {} },
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    setMessages: () => {
      engine.clearConversation()
    },
  }
}
