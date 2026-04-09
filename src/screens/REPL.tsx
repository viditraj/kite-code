/**
 * REPL Screen — Main interactive terminal UI.
 *
 * Architecture (matches Ink's recommended patterns):
 *
 *   <Static>         Completed messages — rendered permanently into terminal
 *                    scrollback. The terminal's native scroll handles history.
 *
 *   Live area        Current streaming response + spinner + prompt input +
 *                    status bar. Ink redraws this region each frame.
 *
 * This design gives us:
 * - Native terminal scrollback (mouse wheel, Shift+PgUp, etc.)
 * - No custom ScrollBox needed (the terminal IS the scroll container)
 * - Smooth streaming (only the live area re-renders)
 * - Memory-efficient (Static content is written once and forgotten by React)
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Box, Text, Static, useInput, useApp } from 'ink'
import { randomUUID } from 'crypto'

import { LogoV2, CondensedLogo } from '../components/LogoV2/LogoV2.js'
import { NotificationToast, useNotifications } from '../components/NotificationToast.js'
import { BackgroundTasksBar, type TaskInfo } from '../components/tasks/TasksView.js'
import { Spinner, type SpinnerMode } from '../components/Spinner/Spinner.js'
import { PromptInput } from '../components/PromptInput/PromptInput.js'
import { ProviderSetup, type ProviderSetupResult } from './ProviderSetup.js'
import { MarketplaceBrowser } from '../components/marketplace/MarketplaceBrowser.js'
import {
  MessageRow,
  MessageDivider,
  type DisplayMessage,
} from '../components/messages/MessageRow.js'
import { PermissionRequest } from '../components/permissions/PermissionRequest.js'
import { StatusBar } from '../components/StatusBar.js'
import {
  InteractiveList,
  getHelpItems,
  getModelItems,
  getProviderItems,
  getModeItems,
  getThemeItems,
  type CommandItem,
} from '../components/InteractiveCommand.js'
import { useTerminalSize } from '../ink/hooks/useTerminalSize.js'

import { QueryEngine } from '../QueryEngine.js'
import type { QueryEvent, Terminal } from '../query/deps.js'
import type { LLMProvider, UnifiedMessage, ContentBlock } from '../providers/types.js'
import type { Tool, Tools, ToolUseContext } from '../Tool.js'
import { createEmptyToolPermissionContext } from '../types/permissions.js'
import type { ToolPermissionContext } from '../types/permissions.js'
import type { KiteConfig } from '../utils/config.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { getAllBaseTools, assembleToolPool } from '../tools.js'
import {
  createSession,
  appendMessage,
  loadSession,
  updateSessionMetadata,
  generateSessionTitle,
  type SessionMetadata,
} from '../utils/session.js'
import { initFileHistory } from '../utils/fileHistory.js'
import { getGitBranch } from '../utils/format.js'
import { saveGlobalConfig } from '../utils/config.js'
import {
  getCommands,
  findCommand,
  executeCommand,
  getCommandNames,
  type Command,
  type LocalCommandContext,
} from '../commands.js'
import { bootstrapMCPTools, shutdownMCP } from '../bootstrap/mcp.js'

// ============================================================================
// Types
// ============================================================================

export interface REPLProps {
  provider: LLMProvider
  config: KiteConfig
  initialPrompt?: string
  options: Record<string, unknown>
}

interface PermissionQueueItem {
  id: string
  toolName: string
  description: string
  message: string
  input: Record<string, unknown>
  resolve: (allowed: boolean) => void
}

type Screen = 'prompt' | 'loading' | 'permission' | 'interactive-command' | 'setup' | 'marketplace'

interface InteractiveCommandState {
  type: 'help' | 'model' | 'provider' | 'mode' | 'theme'
  title: string
  items: CommandItem[]
}

// ============================================================================
// REPL Component
// ============================================================================

export const REPL: React.FC<REPLProps> = ({ provider, config, initialPrompt, options }) => {
  const { exit } = useApp()
  const { columns, rows } = useTerminalSize()

  // ========================================================================
  // State
  // ========================================================================

  // Completed messages go into Static (rendered once, then in terminal scrollback)
  const [completedMessages, setCompletedMessages] = useState<DisplayMessage[]>([])

  // Live messages are the currently-streaming response (re-rendered each frame)
  const [liveMessages, setLiveMessages] = useState<DisplayMessage[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [spinnerMode, setSpinnerMode] = useState<SpinnerMode>('idle')
  const [screen, setScreen] = useState<Screen>('prompt')
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [permissionQueue, setPermissionQueue] = useState<PermissionQueueItem[]>([])
  const [showWelcome, setShowWelcome] = useState(true)
  const [interactiveCmd, setInteractiveCmd] = useState<InteractiveCommandState | null>(null)
  const [showThinking, setShowThinking] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)

  // Notification toast system
  const { notifications, addNotification, dismissNotification } = useNotifications()

  const loadingStartTimeRef = useRef<number>(0)
  const messageCountRef = useRef(0)
  const lastLiveUpdateRef = useRef<number>(0)

  // Session persistence — create on mount (or resume existing session)
  const sessionRef = useRef<SessionMetadata | null>(null)
  useEffect(() => {
    try {
      if (options._resumedSessionId) {
        // Resuming an existing session — use its ID
        const saved = loadSession(options._resumedSessionId as string)
        if (saved) {
          sessionRef.current = saved.metadata
        } else {
          const session = createSession(config.provider.model, process.cwd())
          sessionRef.current = session
        }
      } else {
        const session = createSession(config.provider.model, process.cwd())
        sessionRef.current = session
      }
      if (sessionRef.current) {
        initFileHistory(sessionRef.current.id)
      }
    } catch {
      // Session creation failed — non-fatal
    }
  }, [])

  // Load resumed messages into the conversation display + engine history
  useEffect(() => {
    const resumedMessages = options._resumedMessages as Array<{ role: string; content: string | ContentBlock[] }> | undefined
    if (!resumedMessages || resumedMessages.length === 0) return

    // Populate the display with previous conversation
    const displayMsgs: DisplayMessage[] = resumedMessages.map((msg, i) => ({
      id: `resumed-${i}`,
      role: msg.role as DisplayMessage['role'],
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((b: ContentBlock) => {
            if (b.type === 'text') return b.text
            if (b.type === 'tool_use') return `[Tool: ${b.name}]`
            if (b.type === 'tool_result') return typeof b.content === 'string' ? b.content : '[result]'
            return ''
          }).filter(Boolean).join('\n'),
      timestamp: Date.now() - (resumedMessages.length - i) * 1000,
    }))

    setCompletedMessages(displayMsgs)
    messageCountRef.current = displayMsgs.length
    setShowWelcome(false)

    // Feed messages into the engine so the LLM has conversation context
    for (const msg of resumedMessages) {
      engine.addMessage({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as string | ContentBlock[],
      })
    }
  }, []) // Only on mount

  // Track tools that have been "always allowed" for this session
  const sessionAllowedToolsRef = useRef<Set<string>>(new Set())

  // Git branch tracking
  const gitBranchRef = useRef<string | null>(getGitBranch())

  // ========================================================================
  // QueryEngine setup
  // ========================================================================

  const systemPrompt = useMemo(() => {
    if (options.systemPrompt) return options.systemPrompt as string
    const toolNames = getAllBaseTools().map(t => t.name)
    const base = getSystemPrompt(config.provider.model, toolNames)
    if (options.appendSystemPrompt) return base + '\n\n' + options.appendSystemPrompt
    return base
  }, [config.provider.model, options.systemPrompt, options.appendSystemPrompt])

  const permissionContext = useMemo<ToolPermissionContext>(() => ({
    ...createEmptyToolPermissionContext(),
    mode: (config.behavior.permissionMode as ToolPermissionContext['mode']) ?? 'default',
  }), [config.behavior.permissionMode])

  const engine = useMemo(() => {
    const tools = getAllBaseTools()
    return new QueryEngine({
      provider,
      tools,
      model: config.provider.model,
      maxTokens: config.behavior.maxTokens,
      systemPrompt,
      cwd: process.cwd(),
      debug: !!options.debug,
      verbose: !!options.verbose,
      permissionContext,
      requestPrompt: (toolName, toolInputSummary) => async (request) => {
        // Auto-approve tools that user marked as "always allow" this session
        if (sessionAllowedToolsRef.current.has(toolName)) {
          return { response: 'yes' }
        }

        return new Promise<{ response: string }>((resolve) => {
          const item: PermissionQueueItem = {
            id: randomUUID(),
            toolName,
            description: toolInputSummary ?? request.message,
            message: request.message,
            input: {},
            resolve: (allowed) => {
              resolve({ response: allowed ? 'yes' : 'no' })
            },
          }
          setPermissionQueue(prev => [...prev, item])
          setScreen('permission')
        })
      },
    })
  }, [provider, config, systemPrompt, permissionContext, options])

  useEffect(() => {
    engine['appState']._provider = provider
    engine['appState']._permissionContext = permissionContext
    engine['appState']._config = config
    engine['appState']._sessionId = sessionRef.current?.id
  }, [engine, provider, permissionContext, config])

  // Connect MCP servers and update engine tools
  useEffect(() => {
    let cancelled = false
    bootstrapMCPTools(process.cwd()).then(({ tools: mergedTools, mcpToolCount }) => {
      if (!cancelled && mcpToolCount > 0) {
        engine.setTools(mergedTools)
      }
    }).catch(() => {
      // Non-fatal — continue with built-in tools
    })
    return () => {
      cancelled = true
      shutdownMCP().catch(() => {})
    }
  }, [engine])

  // ========================================================================
  // Helpers: add messages
  // ========================================================================

  const commands = useMemo(() => getCommands(), [])

  /** Add a completed message (goes to Static permanently + saved to session) */
  const addCompleted = useCallback((msg: DisplayMessage) => {
    messageCountRef.current++
    setCompletedMessages(prev => [...prev, msg])

    // Persist to session file
    if (sessionRef.current && (msg.role === 'user' || msg.role === 'assistant')) {
      try {
        appendMessage(sessionRef.current.id, {
          role: msg.role,
          content: msg.content,
        })
        // Update session title on first user message
        if (msg.role === 'user' && sessionRef.current.title === 'Untitled session') {
          const title = generateSessionTitle([{ role: 'user', content: msg.content }])
          if (title !== 'Untitled session') {
            sessionRef.current.title = title
            updateSessionMetadata(sessionRef.current.id, { title })
          }
        }
      } catch {
        // Non-fatal
      }
    }
  }, [])

  /** Add a system message + optional toast notification */
  const addSystemMessage = useCallback((content: string) => {
    addCompleted({
      id: randomUUID(),
      role: 'system',
      content,
      timestamp: Date.now(),
    })

    // Fire toast notifications for key events
    if (content.includes('cancelled')) {
      addNotification(content, 'warning', 3000)
    } else if (content.includes('Conversation cleared') || content.includes('compacted')) {
      addNotification(content, 'success', 3000)
    } else if (content.includes('Error:')) {
      addNotification(content.slice(0, 80), 'error', 5000)
    } else if (content.includes('configured') || content.includes('set to')) {
      addNotification(content.split('\n')[0]!, 'success', 3000)
    }
  }, [addCompleted, addNotification])

  const clearMessages = useCallback(() => {
    setCompletedMessages([])
    setLiveMessages([])
    messageCountRef.current = 0
    setShowWelcome(false)
  }, [])

  const buildCommandContext = useCallback((): LocalCommandContext => {
    return {
      abortController: new AbortController(),
      options: {
        tools: engine['tools'] ?? [],
        commands: [],
        debug: !!options.debug,
        verbose: !!options.verbose,
        mainLoopModel: config.provider.model,
        isNonInteractiveSession: false,
      },
      messages: engine.getConversation() as unknown[],
      getCwd: () => process.cwd(),
      getAppState: () => engine['appState'],
      setAppState: (f) => { engine['appState'] = f(engine['appState']) },
      readFileState: {
        has: () => false,
        get: () => undefined,
        set: () => {},
      },
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      setMessages: (updater) => {
        engine.clearConversation()
        clearMessages()
      },
    }
  }, [engine, config, options, clearMessages])

  // ========================================================================
  // Query execution
  // ========================================================================

  const runQuery = useCallback(async (userInput: string) => {
    // User message goes to completed immediately
    addCompleted({
      id: randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    })

    setIsLoading(true)
    setSpinnerMode('thinking')
    setScreen('loading')
    setLiveMessages([])
    loadingStartTimeRef.current = Date.now()

    let currentAssistantText = ''
    let currentAssistantId = randomUUID()
    let currentThinkingText = ''

    try {
      const gen = engine.run(userInput)
      let result = await gen.next()

      while (!result.done) {
        const event = result.value

        switch (event.type) {
          case 'text_delta':
            currentAssistantText += event.text
            // Show a streaming indicator in the live area — NOT the full text
            // (showing full text causes duplicates when it moves to Static)
            if (Date.now() - lastLiveUpdateRef.current > 200) {
              lastLiveUpdateRef.current = Date.now()
              const lines = currentAssistantText.split('\n').length
              const chars = currentAssistantText.length
              setLiveMessages([{
                id: 'streaming-indicator',
                role: 'system',
                content: `Generating response... (${lines} line${lines !== 1 ? 's' : ''}, ${chars} chars)`,
                timestamp: Date.now(),
              }])
            }
            setSpinnerMode('working')
            break

          case 'thinking_delta':
            currentThinkingText += event.text
            break

          case 'tool_start':
            setSpinnerMode('working')
            break

          case 'tool_result': {
            const ev = event as any
            const toolName = ev.toolName ?? ev.result?.toolName ?? 'tool'
            const output = ev.output ?? ev.result?.output ?? ''
            const isError = ev.isError ?? ev.result?.isError ?? false

            if (currentAssistantText) {
              addCompleted({
                id: currentAssistantId,
                role: 'assistant',
                content: currentAssistantText,
                timestamp: Date.now(),
              })
              currentAssistantText = ''
              currentAssistantId = randomUUID()
            }
            currentThinkingText = ''

            addCompleted({
              id: randomUUID(),
              role: 'tool_result',
              content: typeof output === 'string' ? output : JSON.stringify(output),
              toolName: toolName ?? 'tool',
              isError,
              timestamp: Date.now(),
            })
            setLiveMessages([])
            break
          }

          case 'turn_complete':
            setLiveMessages([])
            if (currentAssistantText) {
              addCompleted({
                id: currentAssistantId,
                role: 'assistant',
                content: currentAssistantText,
                timestamp: Date.now(),
              })
              currentAssistantText = ''
            }
            currentThinkingText = ''
            currentAssistantId = randomUUID()
            setSpinnerMode('thinking')
            break

          case 'error':
            addSystemMessage(`Error: ${(event as any).message}`)
            break

          case 'recovery':
            addSystemMessage(`Recovery: ${(event as any).reason}`)
            break

          case 'message_end': {
            const usage = (event as any).usage
            if (usage) {
              const input = usage.inputTokens ?? 0
              const output = usage.outputTokens ?? 0
              const cacheRead = usage.cacheReadInputTokens ?? 0
              const cacheCreate = usage.cacheCreationInputTokens ?? 0
              setTokenCount(prev => prev + input + output + cacheRead + cacheCreate)

              // Also store in engine appState so /context and /cost commands can read it
              const prev = (engine['appState']._cumulativeUsage ?? {}) as Record<string, number>
              engine['appState']._cumulativeUsage = {
                inputTokens: (prev.inputTokens ?? 0) + input,
                outputTokens: (prev.outputTokens ?? 0) + output,
                cacheReadInputTokens: (prev.cacheReadInputTokens ?? 0) + cacheRead,
                cacheCreationInputTokens: (prev.cacheCreationInputTokens ?? 0) + cacheCreate,
              }
            }
            break
          }
        }

        result = await gen.next()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addSystemMessage(`Error: ${(err as Error).message}`)
      }
    } finally {
      if (currentAssistantText) {
        addCompleted({
          id: currentAssistantId,
          role: 'assistant',
          content: currentAssistantText,
          timestamp: Date.now(),
        })
      }
      setLiveMessages([])
      setIsLoading(false)
      setSpinnerMode('idle')
      setScreen('prompt')
    }
  }, [engine, addCompleted, addSystemMessage])

  // ========================================================================
  // Input submission
  // ========================================================================

  const handleSubmit = useCallback(async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return

    if (showWelcome) setShowWelcome(false)
    setInputHistory(prev => [...prev, trimmed])

    // Slash commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.split(/\s+/)
      const cmdName = parts[0]!.slice(1)
      const args = parts.slice(1).join(' ')
      const cmd = findCommand(cmdName)

      if (cmd) {
        addCompleted({
          id: randomUUID(),
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
        })

        // Interactive commands — show selection UI
        if (cmd.name === 'help' && !args) {
          setInteractiveCmd({ type: 'help', title: 'Commands', items: getHelpItems() })
          setScreen('interactive-command')
          return
        }
        if (cmd.name === 'model' && !args) {
          setInteractiveCmd({ type: 'model', title: 'Select Model', items: getModelItems() })
          setScreen('interactive-command')
          return
        }
        if (cmd.name === 'provider' && !args) {
          setInteractiveCmd({ type: 'provider', title: 'Select Provider', items: getProviderItems() })
          setScreen('interactive-command')
          return
        }
        if (cmd.name === 'mode' && !args) {
          setInteractiveCmd({ type: 'mode', title: 'Permission Mode', items: getModeItems() })
          setScreen('interactive-command')
          return
        }
        if (cmd.name === 'theme' && !args) {
          setInteractiveCmd({ type: 'theme', title: 'Theme', items: getThemeItems() })
          setScreen('interactive-command')
          return
        }

        // Marketplace interactive browser
        if ((cmd.name === 'marketplace' || cmd.name === 'market' || cmd.name === 'mcp-market') && !args) {
          setScreen('marketplace')
          return
        }

        // Non-interactive commands
        if (cmd.name === 'setup') {
          // Launch the full provider setup wizard
          setScreen('setup')
          return
        }
        if (cmd.name === 'thinking') {
          setShowThinking(prev => !prev)
          addSystemMessage(showThinking
            ? 'Thinking display disabled.'
            : 'Thinking display enabled. Model reasoning will be shown during responses.')
          return
        }
        if (cmd.name === 'clear') {
          engine.clearConversation()
          clearMessages()
          addSystemMessage('Conversation cleared.')
          return
        }
        if (cmd.name === 'exit') {
          exit()
          return
        }
        // Prompt commands (like /summary, /review, skills) — send to LLM as a query
        if (cmd.type === 'prompt') {
          try {
            const ctx = buildCommandContext()
            const result = await executeCommand(cmdName, args, ctx)
            if (result && result.type === 'text' && result.value) {
              // For skills with arguments, prepend the user's input so the LLM sees it
              const queryText = args
                ? `${result.value}\n\nUser's input: ${args}`
                : result.value
              await runQuery(queryText)
            }
          } catch (err) {
            addSystemMessage(`Command error: ${(err as Error).message}`)
          }
          return
        }
        try {
          const ctx = buildCommandContext()
          const result = await executeCommand(cmdName, args, ctx)
          if (result && result.type === 'text') addSystemMessage(result.value)
          else if (result && result.type === 'compact') addSystemMessage(result.displayText ?? 'Conversation compacted.')
        } catch (err) {
          addSystemMessage(`Command error: ${(err as Error).message}`)
        }
        return
      } else {
        addSystemMessage(`Unknown command: ${trimmed}. Type /help for available commands.`)
        return
      }
    }

    await runQuery(trimmed)
  }, [showWelcome, engine, addCompleted, addSystemMessage, clearMessages, buildCommandContext, runQuery, exit])

  // ========================================================================
  // Abort handling
  // ========================================================================

  useInput((input, key) => {
    // Don't handle input when permission dialog, interactive command, or marketplace is active
    if (screen === 'permission' || screen === 'interactive-command' || screen === 'marketplace') return

    if (key.ctrl && input === 'c' && isLoading) {
      engine.abort()
      addSystemMessage('Request cancelled.')
      setLiveMessages([])
      setIsLoading(false)
      setSpinnerMode('idle')
      setScreen('prompt')
      return
    }
    if (key.ctrl && input === 'c' && !isLoading) {
      exit()
      return
    }
    if (key.escape && isLoading) {
      engine.abort()
      addSystemMessage('Request cancelled.')
      setLiveMessages([])
      setIsLoading(false)
      setSpinnerMode('idle')
      setScreen('prompt')
      return
    }
  })

  // ========================================================================
  // Permission handling
  // ========================================================================

  const handlePermissionAllow = useCallback(() => {
    const item = permissionQueue[0]
    if (item) {
      item.resolve(true)
      setPermissionQueue(prev => prev.slice(1))
      if (permissionQueue.length <= 1) setScreen('loading')
    }
  }, [permissionQueue])

  const handlePermissionAlwaysAllow = useCallback(() => {
    const item = permissionQueue[0]
    if (item) {
      // Add tool to session-allowed set so future uses auto-approve
      sessionAllowedToolsRef.current.add(item.toolName)
      item.resolve(true)
      setPermissionQueue(prev => prev.slice(1))
      if (permissionQueue.length <= 1) setScreen('loading')
    }
  }, [permissionQueue])

  const handlePermissionDeny = useCallback(() => {
    const item = permissionQueue[0]
    if (item) {
      item.resolve(false)
      setPermissionQueue(prev => prev.slice(1))
      if (permissionQueue.length <= 1) setScreen('loading')
    }
  }, [permissionQueue])

  // ========================================================================
  // Interactive command selection handler
  // ========================================================================

  const handleInteractiveSelect = useCallback((item: CommandItem) => {
    if (!interactiveCmd) return

    switch (interactiveCmd.type) {
      case 'help':
        // User selected a command from help — execute it
        setInteractiveCmd(null)
        setScreen('prompt')
        void handleSubmit(`/${item.value}`)
        return

      case 'model': {
        const appState = engine['appState']
        if (appState._config) {
          ;(appState._config as any).provider.model = item.value
        }
        addSystemMessage(`Model changed to: ${item.value}`)
        setInteractiveCmd(null)
        setScreen('prompt')
        return
      }

      case 'provider': {
        // If user picks "Custom", launch the full setup wizard
        if (item.value === '__setup__') {
          setInteractiveCmd(null)
          setScreen('setup')
          return
        }
        const appState = engine['appState']
        if (appState._config) {
          const cfg = (appState._config as any).provider
          cfg.name = item.value
          if (item.meta?.model) cfg.model = item.meta.model
          if (item.meta?.apiKeyEnv !== undefined) cfg.apiKeyEnv = item.meta.apiKeyEnv
          if (item.meta?.apiBaseUrl !== undefined) cfg.apiBaseUrl = item.meta.apiBaseUrl
        }
        const details = [
          `Provider: ${item.value}`,
          item.meta?.model ? `Model: ${item.meta.model}` : '',
          item.meta?.apiKeyEnv ? `API Key: $\{${item.meta.apiKeyEnv}\}` : '',
          item.meta?.apiBaseUrl ? `Base URL: ${item.meta.apiBaseUrl}` : '',
          '',
          'Note: Restart Kite for the new provider to take effect.',
        ].filter(Boolean).join('\n')
        addSystemMessage(details)
        setInteractiveCmd(null)
        setScreen('prompt')
        return
      }

      case 'mode': {
        addSystemMessage(`Permission mode changed to: ${item.value}`)
        setInteractiveCmd(null)
        setScreen('prompt')
        return
      }

      case 'theme': {
        import('../themes/activeTheme.js').then(m => m.setActiveTheme(item.value as any))
        engine['appState'].theme = item.value
        addSystemMessage(`Theme set to: ${item.value}`)
        setInteractiveCmd(null)
        setScreen('prompt')
        return
      }
    }
  }, [interactiveCmd, engine, addSystemMessage, handleSubmit])

  const handleInteractiveCancel = useCallback(() => {
    setInteractiveCmd(null)
    setScreen('prompt')
  }, [])

  // ========================================================================
  // Setup wizard completion
  // ========================================================================

  const handleSetupComplete = useCallback((result: ProviderSetupResult) => {
    // Apply to in-memory config
    const appState = engine['appState']
    if (appState._config) {
      const cfg = (appState._config as any).provider
      cfg.name = result.providerName
      cfg.model = result.model
      cfg.apiKeyEnv = result.apiKeyEnv
      cfg.apiBaseUrl = result.apiBaseUrl
      cfg.verifySsl = result.verifySsl
    }

    const providerData = {
      name: result.providerName,
      model: result.model,
      apiKeyEnv: result.apiKeyEnv,
      apiBaseUrl: result.apiBaseUrl || undefined,
      verifySsl: result.verifySsl,
    }

    // Save to ~/.kite/config.json (global config)
    try {
      saveGlobalConfig((current) => ({
        ...current,
        provider: providerData,
      }))
    } catch {
      // Non-fatal
    }

    // Also update local kite.config.json if it exists (it takes priority over global)
    try {
      const { existsSync, readFileSync, writeFileSync } = require('fs')
      const { join } = require('path')
      const localPath = join(process.cwd(), 'kite.config.json')
      if (existsSync(localPath)) {
        const raw = readFileSync(localPath, 'utf-8')
        const data = JSON.parse(raw)
        data.provider = { ...data.provider, ...providerData }
        writeFileSync(localPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
      }
    } catch {
      // Non-fatal
    }

    const sslNote = result.verifySsl === false ? '\n  SSL: verification disabled' : ''
    addSystemMessage(
      `Provider configured:\n  ${result.providerName} / ${result.model}` +
      (result.apiBaseUrl ? `\n  URL: ${result.apiBaseUrl}` : '') +
      sslNote +
      '\n\nRestart Kite for changes to take full effect.',
    )
    setScreen('prompt')
  }, [engine, config, addSystemMessage])

  const handleSetupSkip = useCallback(() => {
    setScreen('prompt')
  }, [])

  // ========================================================================
  // Marketplace handlers
  // ========================================================================

  const handleMarketplaceExit = useCallback(() => {
    setScreen('prompt')
  }, [])

  const handleMarketplaceInstalled = useCallback((serverName: string, message: string) => {
    addSystemMessage(message)
  }, [addSystemMessage])

  // ========================================================================
  // Initial prompt
  // ========================================================================

  useEffect(() => {
    if (initialPrompt) void handleSubmit(initialPrompt)
  }, []) // Only on mount

  // ========================================================================
  // Render
  // ========================================================================

  const currentPermission = permissionQueue[0]
  const totalMessages = messageCountRef.current

  return (
    <>
      {/* ================================================================
          STATIC AREA — completed messages (native terminal scrollback)
          ================================================================ */}

      <Static items={completedMessages}>
        {(msg) => (
          <Box key={msg.id} flexDirection="column" paddingBottom={1}>
            <MessageRow message={msg} />
          </Box>
        )}
      </Static>

      {/* ================================================================
          LIVE AREA — only the active streaming + controls
          ================================================================ */}

      {/* Welcome banner — shown until first user interaction */}
      {showWelcome && completedMessages.length === 0 && !isLoading && (
        columns > 60
          ? <LogoV2
              version="0.1.0"
              model={config.provider.model}
              provider={config.provider.name}
              cwd={process.cwd()}
            />
          : <CondensedLogo version="0.1.0" model={config.provider.model} />
      )}

      {/* Currently streaming response */}
      {liveMessages.length > 0 && (
        <Box flexDirection="column">
          {liveMessages.map(msg => (
            <Box key={msg.id} flexDirection="column" paddingBottom={1}>
              <MessageRow message={msg} />
            </Box>
          ))}
        </Box>
      )}

      {/* Permission dialog */}
      {screen === 'permission' && currentPermission && (
        <PermissionRequest
          toolName={currentPermission.toolName}
          description={currentPermission.description}
          message={currentPermission.message}
          input={currentPermission.input}
          onAllow={handlePermissionAllow}
          onAllowAlways={handlePermissionAlwaysAllow}
          onDeny={handlePermissionDeny}
        />
      )}

      {/* Interactive command picker */}
      {screen === 'interactive-command' && interactiveCmd && (
        <InteractiveList
          title={interactiveCmd.title}
          items={interactiveCmd.items}
          onSelect={handleInteractiveSelect}
          onCancel={handleInteractiveCancel}
          isActive={screen === 'interactive-command'}
        />
      )}

      {/* Full provider setup wizard */}
      {screen === 'setup' && (
        <ProviderSetup
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}

      {/* Marketplace browser */}
      {screen === 'marketplace' && (
        <MarketplaceBrowser
          onExit={handleMarketplaceExit}
          onInstalled={handleMarketplaceInstalled}
          cwd={process.cwd()}
          isActive={screen === 'marketplace'}
        />
      )}

      {/* Prompt input + Status bar — wrapped in a single column box */}
      <Box flexDirection="column">
        {/* Notification toasts */}
        <NotificationToast
          notifications={notifications}
          onDismiss={dismissNotification}
        />

        {/* Background tasks panel */}
        {(() => {
          const tasks: TaskInfo[] = Object.values(
            (engine['appState'].tasks ?? {}) as Record<string, any>,
          ).map((t: any) => ({
            id: t.id ?? '',
            subject: t.description ?? t.subject ?? 'Task',
            status: t.status ?? 'pending',
            type: t.type === 'local_agent' ? 'agent' : t.type,
            progress: t.progress ? {
              toolCount: t.progress.toolUseCount,
              tokenCount: t.progress.tokenCount,
              lastActivity: t.progress.recentActivities?.[t.progress.recentActivities.length - 1]?.toolName,
            } : undefined,
          }))
          return tasks.length > 0 ? <BackgroundTasksBar tasks={tasks} /> : null
        })()}

        {/* Spinner while loading */}
        {isLoading && screen !== 'permission' && (
          <Spinner
            mode={spinnerMode}
            showElapsed
            startTime={loadingStartTimeRef.current}
          />
        )}

        {/* Prompt input */}
        {!isLoading && screen === 'prompt' && (
          <PromptInput
            onSubmit={handleSubmit}
            placeholder={showWelcome && completedMessages.length === 0 ? 'Ask anything...' : 'Type a message or /help for commands...'}
            prefix={'> '}
            history={inputHistory}
            isActive={!isLoading && screen === 'prompt'}
          />
        )}

        {/* Status bar — hidden during welcome to keep live area small */}
        {!(showWelcome && completedMessages.length === 0 && !isLoading) && (
          <StatusBar
            model={config.provider.model}
            provider={config.provider.name}
            isLoading={isLoading}
            messageCount={totalMessages}
            tokenCount={tokenCount}
            gitBranch={gitBranchRef.current}
            columns={columns}
          />
        )}
      </Box>
    </>
  )
}
