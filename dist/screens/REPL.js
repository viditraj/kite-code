import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Box, Static, useInput, useApp } from 'ink';
import { randomUUID } from 'crypto';
import { LogoV2, CondensedLogo } from '../components/LogoV2/LogoV2.js';
import { Spinner } from '../components/Spinner/Spinner.js';
import { PromptInput } from '../components/PromptInput/PromptInput.js';
import { MessageRow, } from '../components/messages/MessageRow.js';
import { PermissionRequest } from '../components/permissions/PermissionRequest.js';
import { StatusBar } from '../components/StatusBar.js';
import { InteractiveList, getHelpItems, getModelItems, getProviderItems, getModeItems, getThemeItems, } from '../components/InteractiveCommand.js';
import { useTerminalSize } from '../ink/hooks/useTerminalSize.js';
import { QueryEngine } from '../QueryEngine.js';
import { createEmptyToolPermissionContext } from '../types/permissions.js';
import { getSystemPrompt } from '../constants/prompts.js';
import { getAllBaseTools } from '../tools.js';
import { createSession, appendMessage, loadSession, updateSessionMetadata, generateSessionTitle, } from '../utils/session.js';
import { initFileHistory } from '../utils/fileHistory.js';
import { getGitBranch } from '../utils/format.js';
import { getCommands, findCommand, executeCommand, } from '../commands.js';
import { bootstrapMCPTools, shutdownMCP } from '../bootstrap/mcp.js';
// ============================================================================
// REPL Component
// ============================================================================
export const REPL = ({ provider, config, initialPrompt, options }) => {
    const { exit } = useApp();
    const { columns, rows } = useTerminalSize();
    // ========================================================================
    // State
    // ========================================================================
    // Completed messages go into Static (rendered once, then in terminal scrollback)
    const [completedMessages, setCompletedMessages] = useState([]);
    // Live messages are the currently-streaming response (re-rendered each frame)
    const [liveMessages, setLiveMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [spinnerMode, setSpinnerMode] = useState('idle');
    const [screen, setScreen] = useState('prompt');
    const [inputHistory, setInputHistory] = useState([]);
    const [permissionQueue, setPermissionQueue] = useState([]);
    const [showWelcome, setShowWelcome] = useState(true);
    const [interactiveCmd, setInteractiveCmd] = useState(null);
    const [showThinking, setShowThinking] = useState(false);
    const [tokenCount, setTokenCount] = useState(0);
    const loadingStartTimeRef = useRef(0);
    const messageCountRef = useRef(0);
    const lastLiveUpdateRef = useRef(0);
    // Session persistence — create on mount (or resume existing session)
    const sessionRef = useRef(null);
    useEffect(() => {
        try {
            if (options._resumedSessionId) {
                // Resuming an existing session — use its ID
                const saved = loadSession(options._resumedSessionId);
                if (saved) {
                    sessionRef.current = saved.metadata;
                }
                else {
                    const session = createSession(config.provider.model, process.cwd());
                    sessionRef.current = session;
                }
            }
            else {
                const session = createSession(config.provider.model, process.cwd());
                sessionRef.current = session;
            }
            if (sessionRef.current) {
                initFileHistory(sessionRef.current.id);
            }
        }
        catch {
            // Session creation failed — non-fatal
        }
    }, []);
    // Load resumed messages into the conversation display + engine history
    useEffect(() => {
        const resumedMessages = options._resumedMessages;
        if (!resumedMessages || resumedMessages.length === 0)
            return;
        // Populate the display with previous conversation
        const displayMsgs = resumedMessages.map((msg, i) => ({
            id: `resumed-${i}`,
            role: msg.role,
            content: typeof msg.content === 'string'
                ? msg.content
                : msg.content.map((b) => {
                    if (b.type === 'text')
                        return b.text;
                    if (b.type === 'tool_use')
                        return `[Tool: ${b.name}]`;
                    if (b.type === 'tool_result')
                        return typeof b.content === 'string' ? b.content : '[result]';
                    return '';
                }).filter(Boolean).join('\n'),
            timestamp: Date.now() - (resumedMessages.length - i) * 1000,
        }));
        setCompletedMessages(displayMsgs);
        messageCountRef.current = displayMsgs.length;
        setShowWelcome(false);
        // Feed messages into the engine so the LLM has conversation context
        for (const msg of resumedMessages) {
            engine.addMessage({
                role: msg.role,
                content: msg.content,
            });
        }
    }, []); // Only on mount
    // Track tools that have been "always allowed" for this session
    const sessionAllowedToolsRef = useRef(new Set());
    // Git branch tracking
    const gitBranchRef = useRef(getGitBranch());
    // ========================================================================
    // QueryEngine setup
    // ========================================================================
    const systemPrompt = useMemo(() => {
        if (options.systemPrompt)
            return options.systemPrompt;
        const toolNames = getAllBaseTools().map(t => t.name);
        const base = getSystemPrompt(config.provider.model, toolNames);
        if (options.appendSystemPrompt)
            return base + '\n\n' + options.appendSystemPrompt;
        return base;
    }, [config.provider.model, options.systemPrompt, options.appendSystemPrompt]);
    const permissionContext = useMemo(() => ({
        ...createEmptyToolPermissionContext(),
        mode: config.behavior.permissionMode ?? 'default',
    }), [config.behavior.permissionMode]);
    const engine = useMemo(() => {
        const tools = getAllBaseTools();
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
                    return { response: 'yes' };
                }
                return new Promise((resolve) => {
                    const item = {
                        id: randomUUID(),
                        toolName,
                        description: toolInputSummary ?? request.message,
                        message: request.message,
                        input: {},
                        resolve: (allowed) => {
                            resolve({ response: allowed ? 'yes' : 'no' });
                        },
                    };
                    setPermissionQueue(prev => [...prev, item]);
                    setScreen('permission');
                });
            },
        });
    }, [provider, config, systemPrompt, permissionContext, options]);
    useEffect(() => {
        engine['appState']._provider = provider;
        engine['appState']._permissionContext = permissionContext;
    }, [engine, provider, permissionContext]);
    // Connect MCP servers and update engine tools
    useEffect(() => {
        let cancelled = false;
        bootstrapMCPTools(process.cwd()).then(({ tools: mergedTools, mcpToolCount }) => {
            if (!cancelled && mcpToolCount > 0) {
                engine.setTools(mergedTools);
            }
        }).catch(() => {
            // Non-fatal — continue with built-in tools
        });
        return () => {
            cancelled = true;
            shutdownMCP().catch(() => { });
        };
    }, [engine]);
    // ========================================================================
    // Helpers: add messages
    // ========================================================================
    const commands = useMemo(() => getCommands(), []);
    /** Add a completed message (goes to Static permanently + saved to session) */
    const addCompleted = useCallback((msg) => {
        messageCountRef.current++;
        setCompletedMessages(prev => [...prev, msg]);
        // Persist to session file
        if (sessionRef.current && (msg.role === 'user' || msg.role === 'assistant')) {
            try {
                appendMessage(sessionRef.current.id, {
                    role: msg.role,
                    content: msg.content,
                });
                // Update session title on first user message
                if (msg.role === 'user' && sessionRef.current.title === 'Untitled session') {
                    const title = generateSessionTitle([{ role: 'user', content: msg.content }]);
                    if (title !== 'Untitled session') {
                        sessionRef.current.title = title;
                        updateSessionMetadata(sessionRef.current.id, { title });
                    }
                }
            }
            catch {
                // Non-fatal
            }
        }
    }, []);
    /** Add a system message */
    const addSystemMessage = useCallback((content) => {
        addCompleted({
            id: randomUUID(),
            role: 'system',
            content,
            timestamp: Date.now(),
        });
    }, [addCompleted]);
    const clearMessages = useCallback(() => {
        setCompletedMessages([]);
        setLiveMessages([]);
        messageCountRef.current = 0;
        setShowWelcome(false);
    }, []);
    const buildCommandContext = useCallback(() => {
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
            messages: engine.getConversation(),
            getCwd: () => process.cwd(),
            getAppState: () => engine['appState'],
            setAppState: (f) => { engine['appState'] = f(engine['appState']); },
            readFileState: {
                has: () => false,
                get: () => undefined,
                set: () => { },
            },
            setInProgressToolUseIDs: () => { },
            setResponseLength: () => { },
            setMessages: (updater) => {
                engine.clearConversation();
                clearMessages();
            },
        };
    }, [engine, config, options, clearMessages]);
    // ========================================================================
    // Query execution
    // ========================================================================
    const runQuery = useCallback(async (userInput) => {
        // User message goes to completed immediately
        addCompleted({
            id: randomUUID(),
            role: 'user',
            content: userInput,
            timestamp: Date.now(),
        });
        setIsLoading(true);
        setSpinnerMode('thinking');
        setScreen('loading');
        setLiveMessages([]);
        loadingStartTimeRef.current = Date.now();
        let currentAssistantText = '';
        let currentAssistantId = randomUUID();
        let currentThinkingText = '';
        try {
            const gen = engine.run(userInput);
            let result = await gen.next();
            while (!result.done) {
                const event = result.value;
                switch (event.type) {
                    case 'text_delta':
                        currentAssistantText += event.text;
                        // Show a streaming indicator in the live area — NOT the full text
                        // (showing full text causes duplicates when it moves to Static)
                        if (Date.now() - lastLiveUpdateRef.current > 200) {
                            lastLiveUpdateRef.current = Date.now();
                            const lines = currentAssistantText.split('\n').length;
                            const chars = currentAssistantText.length;
                            setLiveMessages([{
                                    id: 'streaming-indicator',
                                    role: 'system',
                                    content: `Generating response... (${lines} line${lines !== 1 ? 's' : ''}, ${chars} chars)`,
                                    timestamp: Date.now(),
                                }]);
                        }
                        setSpinnerMode('working');
                        break;
                    case 'thinking_delta':
                        currentThinkingText += event.text;
                        break;
                    case 'tool_start':
                        setSpinnerMode('working');
                        break;
                    case 'tool_result': {
                        const ev = event;
                        const toolName = ev.toolName ?? ev.result?.toolName ?? 'tool';
                        const output = ev.output ?? ev.result?.output ?? '';
                        const isError = ev.isError ?? ev.result?.isError ?? false;
                        if (currentAssistantText) {
                            addCompleted({
                                id: currentAssistantId,
                                role: 'assistant',
                                content: currentAssistantText,
                                timestamp: Date.now(),
                            });
                            currentAssistantText = '';
                            currentAssistantId = randomUUID();
                        }
                        currentThinkingText = '';
                        addCompleted({
                            id: randomUUID(),
                            role: 'tool_result',
                            content: typeof output === 'string' ? output : JSON.stringify(output),
                            toolName: toolName ?? 'tool',
                            isError,
                            timestamp: Date.now(),
                        });
                        setLiveMessages([]);
                        break;
                    }
                    case 'turn_complete':
                        setLiveMessages([]);
                        if (currentAssistantText) {
                            addCompleted({
                                id: currentAssistantId,
                                role: 'assistant',
                                content: currentAssistantText,
                                timestamp: Date.now(),
                            });
                            currentAssistantText = '';
                        }
                        currentThinkingText = '';
                        currentAssistantId = randomUUID();
                        setSpinnerMode('thinking');
                        break;
                    case 'error':
                        addSystemMessage(`Error: ${event.message}`);
                        break;
                    case 'recovery':
                        addSystemMessage(`Recovery: ${event.reason}`);
                        break;
                    case 'message_end': {
                        const usage = event.usage;
                        if (usage) {
                            const input = usage.inputTokens ?? 0;
                            const output = usage.outputTokens ?? 0;
                            const cacheRead = usage.cacheReadInputTokens ?? 0;
                            const cacheCreate = usage.cacheCreationInputTokens ?? 0;
                            setTokenCount(prev => prev + input + output + cacheRead + cacheCreate);
                            // Also store in engine appState so /context and /cost commands can read it
                            const prev = (engine['appState']._cumulativeUsage ?? {});
                            engine['appState']._cumulativeUsage = {
                                inputTokens: (prev.inputTokens ?? 0) + input,
                                outputTokens: (prev.outputTokens ?? 0) + output,
                                cacheReadInputTokens: (prev.cacheReadInputTokens ?? 0) + cacheRead,
                                cacheCreationInputTokens: (prev.cacheCreationInputTokens ?? 0) + cacheCreate,
                            };
                        }
                        break;
                    }
                }
                result = await gen.next();
            }
        }
        catch (err) {
            if (err.name !== 'AbortError') {
                addSystemMessage(`Error: ${err.message}`);
            }
        }
        finally {
            if (currentAssistantText) {
                addCompleted({
                    id: currentAssistantId,
                    role: 'assistant',
                    content: currentAssistantText,
                    timestamp: Date.now(),
                });
            }
            setLiveMessages([]);
            setIsLoading(false);
            setSpinnerMode('idle');
            setScreen('prompt');
        }
    }, [engine, addCompleted, addSystemMessage]);
    // ========================================================================
    // Input submission
    // ========================================================================
    const handleSubmit = useCallback(async (input) => {
        const trimmed = input.trim();
        if (!trimmed)
            return;
        if (showWelcome)
            setShowWelcome(false);
        setInputHistory(prev => [...prev, trimmed]);
        // Slash commands
        if (trimmed.startsWith('/')) {
            const parts = trimmed.split(/\s+/);
            const cmdName = parts[0].slice(1);
            const args = parts.slice(1).join(' ');
            const cmd = findCommand(cmdName);
            if (cmd) {
                addCompleted({
                    id: randomUUID(),
                    role: 'user',
                    content: trimmed,
                    timestamp: Date.now(),
                });
                // Interactive commands — show selection UI
                if (cmd.name === 'help' && !args) {
                    setInteractiveCmd({ type: 'help', title: 'Commands', items: getHelpItems() });
                    setScreen('interactive-command');
                    return;
                }
                if (cmd.name === 'model' && !args) {
                    setInteractiveCmd({ type: 'model', title: 'Select Model', items: getModelItems() });
                    setScreen('interactive-command');
                    return;
                }
                if (cmd.name === 'provider' && !args) {
                    setInteractiveCmd({ type: 'provider', title: 'Select Provider', items: getProviderItems() });
                    setScreen('interactive-command');
                    return;
                }
                if (cmd.name === 'mode' && !args) {
                    setInteractiveCmd({ type: 'mode', title: 'Permission Mode', items: getModeItems() });
                    setScreen('interactive-command');
                    return;
                }
                if (cmd.name === 'theme' && !args) {
                    setInteractiveCmd({ type: 'theme', title: 'Theme', items: getThemeItems() });
                    setScreen('interactive-command');
                    return;
                }
                // Non-interactive commands
                if (cmd.name === 'setup') {
                    // Show provider picker inline (same as /provider but more guided)
                    setInteractiveCmd({ type: 'provider', title: 'Provider Setup — Select Provider', items: getProviderItems() });
                    setScreen('interactive-command');
                    return;
                }
                if (cmd.name === 'thinking') {
                    setShowThinking(prev => !prev);
                    addSystemMessage(showThinking
                        ? 'Thinking display disabled.'
                        : 'Thinking display enabled. Model reasoning will be shown during responses.');
                    return;
                }
                if (cmd.name === 'clear') {
                    engine.clearConversation();
                    clearMessages();
                    addSystemMessage('Conversation cleared.');
                    return;
                }
                if (cmd.name === 'exit') {
                    exit();
                    return;
                }
                // Prompt commands (like /summary, /review) — send to LLM as a query
                if (cmd.type === 'prompt') {
                    try {
                        const ctx = buildCommandContext();
                        const result = await executeCommand(cmdName, args, ctx);
                        if (result && result.type === 'text' && result.value) {
                            // Run the prompt text as a query to the LLM
                            await runQuery(result.value);
                        }
                    }
                    catch (err) {
                        addSystemMessage(`Command error: ${err.message}`);
                    }
                    return;
                }
                try {
                    const ctx = buildCommandContext();
                    const result = await executeCommand(cmdName, args, ctx);
                    if (result && result.type === 'text')
                        addSystemMessage(result.value);
                    else if (result && result.type === 'compact')
                        addSystemMessage(result.displayText ?? 'Conversation compacted.');
                }
                catch (err) {
                    addSystemMessage(`Command error: ${err.message}`);
                }
                return;
            }
            else {
                addSystemMessage(`Unknown command: ${trimmed}. Type /help for available commands.`);
                return;
            }
        }
        await runQuery(trimmed);
    }, [showWelcome, engine, addCompleted, addSystemMessage, clearMessages, buildCommandContext, runQuery, exit]);
    // ========================================================================
    // Abort handling
    // ========================================================================
    useInput((input, key) => {
        // Don't handle input when permission dialog or interactive command is active
        if (screen === 'permission' || screen === 'interactive-command')
            return;
        if (key.ctrl && input === 'c' && isLoading) {
            engine.abort();
            addSystemMessage('Request cancelled.');
            setLiveMessages([]);
            setIsLoading(false);
            setSpinnerMode('idle');
            setScreen('prompt');
            return;
        }
        if (key.ctrl && input === 'c' && !isLoading) {
            exit();
            return;
        }
        if (key.escape && isLoading) {
            engine.abort();
            addSystemMessage('Request cancelled.');
            setLiveMessages([]);
            setIsLoading(false);
            setSpinnerMode('idle');
            setScreen('prompt');
            return;
        }
    });
    // ========================================================================
    // Permission handling
    // ========================================================================
    const handlePermissionAllow = useCallback(() => {
        const item = permissionQueue[0];
        if (item) {
            item.resolve(true);
            setPermissionQueue(prev => prev.slice(1));
            if (permissionQueue.length <= 1)
                setScreen('loading');
        }
    }, [permissionQueue]);
    const handlePermissionAlwaysAllow = useCallback(() => {
        const item = permissionQueue[0];
        if (item) {
            // Add tool to session-allowed set so future uses auto-approve
            sessionAllowedToolsRef.current.add(item.toolName);
            item.resolve(true);
            setPermissionQueue(prev => prev.slice(1));
            if (permissionQueue.length <= 1)
                setScreen('loading');
        }
    }, [permissionQueue]);
    const handlePermissionDeny = useCallback(() => {
        const item = permissionQueue[0];
        if (item) {
            item.resolve(false);
            setPermissionQueue(prev => prev.slice(1));
            if (permissionQueue.length <= 1)
                setScreen('loading');
        }
    }, [permissionQueue]);
    // ========================================================================
    // Interactive command selection handler
    // ========================================================================
    const handleInteractiveSelect = useCallback((item) => {
        if (!interactiveCmd)
            return;
        switch (interactiveCmd.type) {
            case 'help':
                // User selected a command from help — execute it
                setInteractiveCmd(null);
                setScreen('prompt');
                void handleSubmit(`/${item.value}`);
                return;
            case 'model': {
                const appState = engine['appState'];
                if (appState._config) {
                    ;
                    appState._config.provider.model = item.value;
                }
                addSystemMessage(`Model changed to: ${item.value}`);
                setInteractiveCmd(null);
                setScreen('prompt');
                return;
            }
            case 'provider': {
                const appState = engine['appState'];
                if (appState._config) {
                    const cfg = appState._config.provider;
                    cfg.name = item.value;
                    if (item.meta?.model)
                        cfg.model = item.meta.model;
                    if (item.meta?.apiKeyEnv !== undefined)
                        cfg.apiKeyEnv = item.meta.apiKeyEnv;
                    if (item.meta?.apiBaseUrl !== undefined)
                        cfg.apiBaseUrl = item.meta.apiBaseUrl;
                }
                const details = [
                    `Provider: ${item.value}`,
                    item.meta?.model ? `Model: ${item.meta.model}` : '',
                    item.meta?.apiKeyEnv ? `API Key: $\{${item.meta.apiKeyEnv}\}` : '',
                    item.meta?.apiBaseUrl ? `Base URL: ${item.meta.apiBaseUrl}` : '',
                    '',
                    'Note: Restart Kite for the new provider to take effect.',
                ].filter(Boolean).join('\n');
                addSystemMessage(details);
                setInteractiveCmd(null);
                setScreen('prompt');
                return;
            }
            case 'mode': {
                addSystemMessage(`Permission mode changed to: ${item.value}`);
                setInteractiveCmd(null);
                setScreen('prompt');
                return;
            }
            case 'theme': {
                import('../themes/activeTheme.js').then(m => m.setActiveTheme(item.value));
                engine['appState'].theme = item.value;
                addSystemMessage(`Theme set to: ${item.value}`);
                setInteractiveCmd(null);
                setScreen('prompt');
                return;
            }
        }
    }, [interactiveCmd, engine, addSystemMessage, handleSubmit]);
    const handleInteractiveCancel = useCallback(() => {
        setInteractiveCmd(null);
        setScreen('prompt');
    }, []);
    // ========================================================================
    // Initial prompt
    // ========================================================================
    useEffect(() => {
        if (initialPrompt)
            void handleSubmit(initialPrompt);
    }, []); // Only on mount
    // ========================================================================
    // Render
    // ========================================================================
    const currentPermission = permissionQueue[0];
    const totalMessages = messageCountRef.current;
    return (_jsxs(_Fragment, { children: [_jsx(Static, { items: completedMessages, children: (msg) => (_jsx(Box, { flexDirection: "column", paddingBottom: 1, children: _jsx(MessageRow, { message: msg }) }, msg.id)) }), showWelcome && completedMessages.length === 0 && !isLoading && (columns > 60
                ? _jsx(LogoV2, { version: "0.1.0", model: config.provider.model, provider: config.provider.name, cwd: process.cwd() })
                : _jsx(CondensedLogo, { version: "0.1.0", model: config.provider.model })), liveMessages.length > 0 && (_jsx(Box, { flexDirection: "column", children: liveMessages.map(msg => (_jsx(Box, { flexDirection: "column", paddingBottom: 1, children: _jsx(MessageRow, { message: msg }) }, msg.id))) })), screen === 'permission' && currentPermission && (_jsx(PermissionRequest, { toolName: currentPermission.toolName, description: currentPermission.description, message: currentPermission.message, input: currentPermission.input, onAllow: handlePermissionAllow, onAllowAlways: handlePermissionAlwaysAllow, onDeny: handlePermissionDeny })), screen === 'interactive-command' && interactiveCmd && (_jsx(InteractiveList, { title: interactiveCmd.title, items: interactiveCmd.items, onSelect: handleInteractiveSelect, onCancel: handleInteractiveCancel, isActive: screen === 'interactive-command' })), _jsxs(Box, { flexDirection: "column", children: [isLoading && screen !== 'permission' && (_jsx(Spinner, { mode: spinnerMode, showElapsed: true, startTime: loadingStartTimeRef.current })), !isLoading && screen === 'prompt' && (_jsx(PromptInput, { onSubmit: handleSubmit, placeholder: showWelcome && completedMessages.length === 0 ? 'Ask anything...' : 'Type a message or /help for commands...', prefix: '> ', history: inputHistory, isActive: !isLoading && screen === 'prompt' })), !(showWelcome && completedMessages.length === 0 && !isLoading) && (_jsx(StatusBar, { model: config.provider.model, provider: config.provider.name, isLoading: isLoading, messageCount: totalMessages, tokenCount: tokenCount, gitBranch: gitBranchRef.current, columns: columns }))] })] }));
};
//# sourceMappingURL=REPL.js.map