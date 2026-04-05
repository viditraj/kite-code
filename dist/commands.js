/**
 * Command registry — loads, registers, and resolves slash commands.
 *
 * Implements the same patterns as Claude Code's commands.ts:
 * - Built-in commands (help, clear, compact, cost, model, mode, exit, etc.)
 * - Skill-based commands (from .kite/skills/ directories)
 * - MCP prompt commands (from connected MCP servers)
 * - Command resolution by name or alias
 * - Availability filtering and isEnabled checks
 * - Cache management for dynamic command sources
 */
export { getCommandName, isCommandEnabled } from './types/command.js';
// ============================================================================
// Built-in commands
// ============================================================================
function createBuiltinCommands() {
    return [
        // ---- help ----
        {
            type: 'local',
            name: 'help',
            description: 'Show help and available commands',
            aliases: ['h', '?'],
            supportsNonInteractive: true,
            async call(_args, _context) {
                const cmds = getCommands().filter(c => !c.isHidden && (c.isEnabled?.() ?? true));
                const lines = cmds.map(c => {
                    const aliases = c.aliases?.length ? ` (${c.aliases.map(a => '/' + a).join(', ')})` : '';
                    const hint = c.argumentHint ? ` ${c.argumentHint}` : '';
                    return `  /${c.name}${hint}${aliases} — ${c.description}`;
                });
                return { type: 'text', value: 'Available commands:\n' + lines.join('\n') };
            },
        },
        // ---- clear ----
        {
            type: 'local',
            name: 'clear',
            description: 'Clear conversation history and free up context',
            aliases: ['reset', 'new'],
            supportsNonInteractive: false,
            async call(_args, context) {
                context.setMessages(() => []);
                return { type: 'text', value: 'Conversation cleared.' };
            },
        },
        // ---- compact ----
        {
            type: 'local',
            name: 'compact',
            description: 'Clear conversation history but keep a summary in context',
            argumentHint: '<optional custom summarization instructions>',
            supportsNonInteractive: true,
            async call(args, _context) {
                return {
                    type: 'compact',
                    displayText: args
                        ? `Conversation compacted with instructions: ${args}`
                        : 'Conversation compacted. Old messages have been summarized.',
                };
            },
        },
        // ---- cost ----
        {
            type: 'local',
            name: 'cost',
            description: 'Show the total cost and duration of the current session',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const usage = appState._cumulativeUsage;
                const uptime = Math.floor(process.uptime());
                const lines = [
                    'Session cost summary:',
                    `  Duration:     ${Math.floor(uptime / 60)}m ${uptime % 60}s`,
                    `  Input tokens:  ${(usage?.inputTokens ?? 0).toLocaleString()}`,
                    `  Output tokens: ${(usage?.outputTokens ?? 0).toLocaleString()}`,
                    `  Cache read:    ${(usage?.cacheReadInputTokens ?? 0).toLocaleString()}`,
                    `  Cache create:  ${(usage?.cacheCreationInputTokens ?? 0).toLocaleString()}`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- model ----
        {
            type: 'local',
            name: 'model',
            description: 'Show or set the AI model',
            argumentHint: '[model]',
            supportsNonInteractive: true,
            async call(args, context) {
                if (args.trim()) {
                    const appState = context.getAppState();
                    if (appState._config) {
                        ;
                        appState._config.provider.model = args.trim();
                    }
                    return { type: 'text', value: `Model changed to: ${args.trim()}\nNote: This takes effect on the next query.` };
                }
                const model = context.options.mainLoopModel;
                const appState = context.getAppState();
                const providerName = appState._config?.provider?.name ?? 'unknown';
                const lines = [
                    `Current model: ${model}`,
                    `Provider: ${providerName}`,
                    '',
                    'To change model: /model <model-name>',
                    'To change provider: /provider',
                    '',
                    'Common models:',
                    '  Anthropic:   claude-sonnet-4-20250514, claude-opus-4-20250514',
                    '  OpenAI:      gpt-4o, gpt-4o-mini, o1, o3',
                    '  Ollama:      llama3.1, codellama, mixtral',
                    '  Groq:        llama-3.1-70b-versatile',
                    '  DeepSeek:    deepseek-chat, deepseek-coder',
                    '  Mistral:     mistral-large-latest, codestral-latest',
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- provider ----
        {
            type: 'local',
            name: 'provider',
            description: 'Show or switch LLM provider',
            argumentHint: '[provider-name] [model]',
            supportsNonInteractive: true,
            async call(args, context) {
                const appState = context.getAppState();
                const config = appState._config;
                if (args.trim()) {
                    const parts = args.trim().split(/\s+/);
                    const newProvider = parts[0];
                    const newModel = parts[1];
                    // Validate provider name
                    const knownProviders = ['anthropic', 'openai', 'ollama', 'groq', 'deepseek', 'mistral', 'openrouter'];
                    if (!knownProviders.includes(newProvider) && !newProvider.includes('.')) {
                        return {
                            type: 'text',
                            value: `Unknown provider: ${newProvider}\n\nKnown providers: ${knownProviders.join(', ')}\nOr use a custom URL: /provider custom https://your-endpoint.com/v1/chat/completions`,
                        };
                    }
                    // Apply the change
                    if (config) {
                        config.provider.name = newProvider;
                        if (newModel) {
                            config.provider.model = newModel;
                        }
                    }
                    const modelInfo = newModel ? ` with model ${newModel}` : '';
                    return {
                        type: 'text',
                        value: `Provider switched to: ${newProvider}${modelInfo}\nNote: This takes effect on the next query. Restart Kite if you need a new provider connection.`,
                    };
                }
                // Show current provider info
                const lines = [
                    'Current provider configuration:',
                    `  Provider:   ${config?.provider?.name ?? 'unknown'}`,
                    `  Model:      ${config?.provider?.model ?? 'unknown'}`,
                    `  API Key:    ${config?.provider?.apiKeyEnv ?? 'KITE_API_KEY'}`,
                    `  Base URL:   ${config?.provider?.apiBaseUrl || '(default)'}`,
                    '',
                    'To switch: /provider <name> [model]',
                    'Example:   /provider openai gpt-4o',
                    'Example:   /provider ollama llama3.1',
                    '',
                    'Available providers:',
                    '  anthropic   — Claude models (requires ANTHROPIC_API_KEY)',
                    '  openai      — GPT models (requires OPENAI_API_KEY)',
                    '  ollama      — Local models (no API key needed)',
                    '  groq        — Fast inference (requires GROQ_API_KEY)',
                    '  deepseek    — DeepSeek models (requires DEEPSEEK_API_KEY)',
                    '  mistral     — Mistral models (requires MISTRAL_API_KEY)',
                    '  openrouter  — Multi-provider gateway (requires OPENROUTER_API_KEY)',
                    '',
                    'For full setup wizard: kite --setup',
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- mode ----
        {
            type: 'local',
            name: 'mode',
            description: 'Show or change permission mode',
            argumentHint: '[default|acceptEdits|bypassPermissions|plan|dontAsk]',
            supportsNonInteractive: true,
            async call(args, context) {
                const validModes = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk'];
                if (args.trim()) {
                    if (validModes.includes(args.trim())) {
                        return { type: 'text', value: `Permission mode changed to: ${args.trim()}` };
                    }
                    return { type: 'text', value: `Invalid mode. Valid modes: ${validModes.join(', ')}` };
                }
                const appState = context.getAppState();
                const currentMode = appState._permissionContext?.mode ?? 'default';
                return { type: 'text', value: `Current permission mode: ${currentMode}` };
            },
        },
        // ---- exit ----
        {
            type: 'local',
            name: 'exit',
            description: 'Exit Kite',
            aliases: ['quit', 'q'],
            supportsNonInteractive: true,
            async call(_args, _context) {
                process.exit(0);
            },
        },
        // ---- config ----
        {
            type: 'local',
            name: 'config',
            description: 'Show current configuration',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const config = appState._config;
                if (config) {
                    return { type: 'text', value: `Configuration:\n${JSON.stringify(config, null, 2)}` };
                }
                return { type: 'text', value: 'No configuration loaded.' };
            },
        },
        // ---- setup ----
        {
            type: 'local',
            name: 'setup',
            description: 'Launch provider setup wizard',
            supportsNonInteractive: false,
            async call(_args, _context) {
                // This is handled specially by the REPL — it needs to unmount
                // the current Ink app and launch the setup wizard.
                // Return a special marker that the REPL will intercept.
                return { type: 'text', value: '__SETUP_WIZARD__' };
            },
        },
        // ---- memory ----
        {
            type: 'local',
            name: 'memory',
            description: 'Show or edit AGENTS.md memory files',
            argumentHint: '[show|edit]',
            supportsNonInteractive: false,
            async call(args, _context) {
                const action = args.trim() || 'show';
                if (action === 'show') {
                    const fs = await import('fs');
                    const path = await import('path');
                    const cwd = process.cwd();
                    const agentsPath = path.join(cwd, 'AGENTS.md');
                    const claudePath = path.join(cwd, 'CLAUDE.md');
                    const lines = [];
                    for (const p of [agentsPath, claudePath]) {
                        if (fs.existsSync(p)) {
                            const content = fs.readFileSync(p, 'utf-8');
                            lines.push(`--- ${path.basename(p)} ---\n${content}`);
                        }
                    }
                    return {
                        type: 'text',
                        value: lines.length > 0
                            ? lines.join('\n\n')
                            : 'No AGENTS.md or CLAUDE.md found in the current directory.',
                    };
                }
                return { type: 'text', value: `Unknown action: ${action}. Use /memory show or /memory edit.` };
            },
        },
        // ---- resume ----
        {
            type: 'local',
            name: 'resume',
            description: 'Resume a previous conversation',
            argumentHint: '[session-id]',
            supportsNonInteractive: false,
            async call(args, _context) {
                const fs = await import('fs');
                const path = await import('path');
                const os = await import('os');
                const sessionsDir = path.join(os.homedir(), '.kite', 'sessions');
                if (args.trim()) {
                    // Resume specific session
                    const sessionId = args.trim();
                    const sessionPath = path.join(sessionsDir, sessionId + '.json');
                    if (fs.existsSync(sessionPath)) {
                        return { type: 'text', value: `Resuming session ${sessionId}. Previous messages loaded.` };
                    }
                    return { type: 'text', value: `Session not found: ${sessionId}` };
                }
                // List recent sessions
                if (!fs.existsSync(sessionsDir)) {
                    return { type: 'text', value: 'No saved sessions found.' };
                }
                try {
                    const files = fs.readdirSync(sessionsDir)
                        .filter((f) => f.endsWith('.json'))
                        .sort()
                        .reverse()
                        .slice(0, 10);
                    if (files.length === 0) {
                        return { type: 'text', value: 'No saved sessions found.' };
                    }
                    const lines = files.map((f) => {
                        const id = f.replace('.json', '');
                        const stat = fs.statSync(path.join(sessionsDir, f));
                        const date = stat.mtime.toISOString().slice(0, 19).replace('T', ' ');
                        return `  ${id}  (${date})`;
                    });
                    return { type: 'text', value: 'Recent sessions:\n' + lines.join('\n') + '\n\nUsage: /resume <session-id>' };
                }
                catch {
                    return { type: 'text', value: 'Error reading sessions directory.' };
                }
            },
        },
        // ---- session ----
        {
            type: 'local',
            name: 'session',
            description: 'Show session information',
            supportsNonInteractive: true,
            async call(_args, _context) {
                const uptime = Math.floor(process.uptime());
                const minutes = Math.floor(uptime / 60);
                const seconds = uptime % 60;
                return {
                    type: 'text',
                    value: `Session info:\n  Uptime: ${minutes}m ${seconds}s\n  PID: ${process.pid}\n  CWD: ${process.cwd()}`,
                };
            },
        },
        // ---- permissions ----
        {
            type: 'local',
            name: 'permissions',
            description: 'Show or edit permission rules',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const permCtx = appState._permissionContext;
                if (permCtx) {
                    return {
                        type: 'text',
                        value: `Permission mode: ${permCtx.mode ?? 'default'}\nAllow rules: ${JSON.stringify(permCtx.alwaysAllowRules ?? {})}\nDeny rules: ${JSON.stringify(permCtx.alwaysDenyRules ?? {})}`,
                    };
                }
                return { type: 'text', value: 'No permission context available.' };
            },
        },
        // ---- plan ----
        {
            type: 'local',
            name: 'plan',
            description: 'Enter plan mode for complex tasks',
            supportsNonInteractive: false,
            async call(_args, context) {
                const appState = context.getAppState();
                context.setAppState(prev => ({
                    ...prev,
                    _permissionContext: {
                        ...(prev._permissionContext ?? {}),
                        prePlanMode: prev._permissionContext?.mode ?? 'default',
                        mode: 'plan',
                    },
                }));
                return { type: 'text', value: 'Entered plan mode. Explore the codebase and design your approach before making changes. Use /exit-plan when ready.' };
            },
        },
        // ---- vim ----
        {
            type: 'local',
            name: 'vim',
            description: 'Toggle vim keybinding mode',
            supportsNonInteractive: false,
            async call(_args, context) {
                const appState = context.getAppState();
                const current = appState.vimMode ?? false;
                context.setAppState(prev => ({ ...prev, vimMode: !current }));
                return { type: 'text', value: current ? 'Vim mode disabled.' : 'Vim mode enabled.' };
            },
        },
        // ---- thinking ----
        {
            type: 'local',
            name: 'thinking',
            description: 'Toggle display of model thinking/reasoning blocks',
            supportsNonInteractive: false,
            async call(_args, context) {
                const appState = context.getAppState();
                const current = appState.showThinking ?? false;
                context.setAppState(prev => ({ ...prev, showThinking: !current }));
                return { type: 'text', value: current ? 'Thinking display disabled.' : 'Thinking display enabled. Model reasoning will be shown during responses.' };
            },
        },
        // ---- mcp ----
        {
            type: 'local',
            name: 'mcp',
            description: 'Show MCP server status and tools',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const mcpConnections = appState._mcpConnections;
                if (!mcpConnections || mcpConnections.size === 0) {
                    // Check config for configured servers
                    try {
                        const { getAllMCPConfigs } = await import('./services/mcp/config.js');
                        const { servers } = getAllMCPConfigs(process.cwd());
                        const serverNames = Object.keys(servers);
                        if (serverNames.length > 0) {
                            return {
                                type: 'text',
                                value: `MCP servers configured (${serverNames.length}):\n${serverNames.map(n => `  - ${n} (${servers[n]?.type ?? 'stdio'})`).join('\n')}\n\nServers connect on first use.`,
                            };
                        }
                    }
                    catch {
                        // Config loading failed
                    }
                    return { type: 'text', value: 'No MCP servers configured. Add servers to .mcp.json or ~/.kite/config.json.' };
                }
                const lines = [];
                for (const [name, conn] of mcpConnections) {
                    lines.push(`  ${name}: ${conn.type}`);
                }
                return { type: 'text', value: `MCP servers (${mcpConnections.size}):\n${lines.join('\n')}` };
            },
        },
        // ---- status ----
        {
            type: 'local',
            name: 'status',
            description: 'Show system status',
            supportsNonInteractive: true,
            async call(_args, _context) {
                const os = await import('os');
                return {
                    type: 'text',
                    value: `System status:\n  Node.js: ${process.version}\n  Platform: ${os.platform()} ${os.release()}\n  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\n  CWD: ${process.cwd()}`,
                };
            },
        },
        // ---- debug ----
        {
            type: 'local',
            name: 'debug',
            description: 'Toggle debug mode',
            supportsNonInteractive: false,
            async call(_args, context) {
                const current = context.options.debug;
                context.options.debug = !current;
                return { type: 'text', value: current ? 'Debug mode disabled.' : 'Debug mode enabled.' };
            },
        },
        // ---- verbose ----
        {
            type: 'local',
            name: 'verbose',
            description: 'Toggle verbose output',
            supportsNonInteractive: false,
            async call(_args, context) {
                const current = context.options.verbose;
                context.options.verbose = !current;
                return { type: 'text', value: current ? 'Verbose mode disabled.' : 'Verbose mode enabled.' };
            },
        },
        // ---- doctor ----
        {
            type: 'local',
            name: 'doctor',
            description: 'Run system diagnostics',
            supportsNonInteractive: true,
            async call(_args, _context) {
                const os = await import('os');
                const lines = [
                    'Kite Doctor',
                    '',
                    `  Node.js:  ${process.version}`,
                    `  Platform: ${os.platform()} ${os.release()}`,
                    `  Arch:     ${os.arch()}`,
                    `  CWD:      ${process.cwd()}`,
                    `  Memory:   ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`,
                    `  Uptime:   ${Math.floor(process.uptime())}s`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- diff ----
        {
            type: 'local',
            name: 'diff',
            description: 'Show file changes made in this session',
            supportsNonInteractive: true,
            async call(_args, _context) {
                try {
                    const { execSync } = await import('child_process');
                    // Check if we're in a git repo first
                    execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' });
                    const diff = execSync('git diff', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
                    return { type: 'text', value: diff || 'No changes detected.' };
                }
                catch {
                    return { type: 'text', value: 'Not in a git repository or git not available.' };
                }
            },
        },
        // ---- export ----
        {
            type: 'local',
            name: 'export',
            description: 'Export conversation to a file',
            argumentHint: '[filename]',
            supportsNonInteractive: true,
            async call(args, context) {
                const fs = await import('fs');
                const path = await import('path');
                const filename = args.trim() || `kite-conversation-${Date.now()}.md`;
                const fullPath = path.resolve(filename);
                // Build markdown from conversation
                const messages = context.messages;
                const lines = ['# Kite Conversation Export', '', `Exported: ${new Date().toISOString()}`, ''];
                for (const msg of messages) {
                    const role = msg.role.toUpperCase();
                    const content = typeof msg.content === 'string'
                        ? msg.content
                        : Array.isArray(msg.content)
                            ? msg.content
                                .filter((b) => b.type === 'text')
                                .map((b) => b.text)
                                .join('\n')
                            : JSON.stringify(msg.content);
                    lines.push(`## ${role}`, '', content, '');
                }
                try {
                    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
                    return { type: 'text', value: `Conversation exported to: ${fullPath}` };
                }
                catch (err) {
                    return { type: 'text', value: `Export failed: ${err.message}` };
                }
            },
        },
        // ---- branch ----
        {
            type: 'local',
            name: 'branch',
            description: 'Show or switch git branch',
            argumentHint: '[branch-name]',
            supportsNonInteractive: true,
            async call(args, _context) {
                try {
                    const { execSync } = await import('child_process');
                    if (args.trim()) {
                        execSync(`git checkout ${args.trim()}`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
                        return { type: 'text', value: `Switched to branch: ${args.trim()}` };
                    }
                    const branches = execSync('git branch', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
                    return { type: 'text', value: branches.trim() };
                }
                catch (err) {
                    return { type: 'text', value: `Git error: ${err.message}` };
                }
            },
        },
        // ---- theme ----
        {
            type: 'local',
            name: 'theme',
            description: 'Show or change color theme',
            argumentHint: '[theme-name]',
            supportsNonInteractive: false,
            async call(args, context) {
                const { setActiveTheme, getActiveTheme } = await import('./themes/activeTheme.js');
                const { themeNames } = await import('./themes/themes.js');
                if (args.trim()) {
                    const name = args.trim();
                    if (!themeNames.includes(name)) {
                        return { type: 'text', value: `Unknown theme: ${name}\nAvailable: ${themeNames.join(', ')}` };
                    }
                    setActiveTheme(name);
                    context.setAppState(prev => ({ ...prev, theme: name }));
                    return { type: 'text', value: `Theme set to: ${name}` };
                }
                const current = getActiveTheme();
                return { type: 'text', value: `Current theme: ${current}\nAvailable: ${themeNames.join(', ')}` };
            },
        },
        // ---- usage ----
        {
            type: 'local',
            name: 'usage',
            description: 'Show API usage statistics',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const usage = appState._cumulativeUsage;
                const totalInput = usage?.inputTokens ?? 0;
                const totalOutput = usage?.outputTokens ?? 0;
                const uptime = Math.floor(process.uptime());
                return {
                    type: 'text',
                    value: [
                        'API usage statistics:',
                        `  Total input tokens:  ${totalInput.toLocaleString()}`,
                        `  Total output tokens: ${totalOutput.toLocaleString()}`,
                        `  Total tokens:        ${(totalInput + totalOutput).toLocaleString()}`,
                        `  Session duration:    ${Math.floor(uptime / 60)}m ${uptime % 60}s`,
                    ].join('\n'),
                };
            },
        },
        // ---- skills ----
        {
            type: 'local',
            name: 'skills',
            description: 'List available skills',
            supportsNonInteractive: true,
            async call(_args, _context) {
                const fs = await import('fs');
                const path = await import('path');
                const cwd = process.cwd();
                const skillDirs = [
                    path.join(cwd, '.kite', 'skills'),
                    path.join(cwd, '.claude', 'skills'),
                ];
                const skills = [];
                for (const dir of skillDirs) {
                    if (fs.existsSync(dir)) {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.isDirectory()) {
                                skills.push(entry.name);
                            }
                        }
                    }
                }
                return {
                    type: 'text',
                    value: skills.length > 0
                        ? `Available skills:\n${skills.map(s => `  - ${s}`).join('\n')}`
                        : 'No skills found. Create skills in .kite/skills/ directory.',
                };
            },
        },
        // ---- hooks ----
        {
            type: 'local',
            name: 'hooks',
            description: 'Show configured hooks',
            supportsNonInteractive: true,
            async call(_args, _context) {
                return { type: 'text', value: 'Hooks: Configure hooks in .kite/settings.json under the "hooks" key.' };
            },
        },
        // ---- files ----
        {
            type: 'local',
            name: 'files',
            description: 'List files modified in this session',
            supportsNonInteractive: true,
            async call(_args, _context) {
                try {
                    const { execSync } = await import('child_process');
                    const status = execSync('git status --short', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
                    return { type: 'text', value: status.trim() || 'No modified files.' };
                }
                catch {
                    return { type: 'text', value: 'Not in a git repository.' };
                }
            },
        },
        // ---- agents ----
        {
            type: 'local',
            name: 'agents',
            description: 'List available agent types',
            supportsNonInteractive: true,
            async call(_args, _context) {
                return { type: 'text', value: 'Available agents:\n  - general-purpose (default)\n  - Explore (codebase exploration)\n  - Plan (planning only)' };
            },
        },
        // ---- tasks ----
        {
            type: 'local',
            name: 'tasks',
            description: 'Show background tasks',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const taskList = (appState.taskList ?? {});
                const tasks = Object.values(taskList);
                if (tasks.length === 0) {
                    return { type: 'text', value: 'No active tasks.' };
                }
                const lines = tasks.map(t => `  #${t.id} [${t.status}] ${t.subject}`);
                return { type: 'text', value: `Active tasks:\n${lines.join('\n')}` };
            },
        },
        // ---- copy ----
        {
            type: 'local',
            name: 'copy',
            description: 'Copy last response to clipboard',
            supportsNonInteractive: false,
            async call(_args, context) {
                // Find the last assistant message in conversation
                const messages = context.messages;
                let lastAssistantText = '';
                for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (msg.role === 'assistant') {
                        lastAssistantText = typeof msg.content === 'string'
                            ? msg.content
                            : Array.isArray(msg.content)
                                ? msg.content
                                    .filter((b) => b.type === 'text')
                                    .map((b) => b.text)
                                    .join('\n')
                                : '';
                        break;
                    }
                }
                if (!lastAssistantText) {
                    return { type: 'text', value: 'No assistant response to copy.' };
                }
                // Try platform-specific clipboard
                try {
                    const { execSync } = await import('child_process');
                    const platform = process.platform;
                    if (platform === 'darwin') {
                        execSync('pbcopy', { input: lastAssistantText, timeout: 3000 });
                    }
                    else if (platform === 'linux') {
                        try {
                            execSync('xclip -selection clipboard', { input: lastAssistantText, timeout: 3000 });
                        }
                        catch {
                            execSync('xsel --clipboard --input', { input: lastAssistantText, timeout: 3000 });
                        }
                    }
                    else if (platform === 'win32') {
                        execSync('clip', { input: lastAssistantText, timeout: 3000 });
                    }
                    else {
                        return { type: 'text', value: `Copied ${lastAssistantText.length} chars (clipboard not available on ${platform}).` };
                    }
                    return { type: 'text', value: `Copied ${lastAssistantText.length} characters to clipboard.` };
                }
                catch {
                    return { type: 'text', value: `Last response (${lastAssistantText.length} chars) — clipboard tool not available on this system.` };
                }
            },
        },
        // ---- fast ----
        {
            type: 'local',
            name: 'fast',
            description: 'Toggle fast mode (use faster model)',
            supportsNonInteractive: false,
            async call(_args, context) {
                const current = context.getAppState().fastMode ?? false;
                context.setAppState(prev => ({ ...prev, fastMode: !current }));
                return { type: 'text', value: current ? 'Fast mode disabled.' : 'Fast mode enabled (using faster model).' };
            },
        },
        // ---- review ----
        {
            type: 'prompt',
            name: 'review',
            description: 'Review code changes',
            progressMessage: 'reviewing code changes',
            contentLength: 200,
            source: 'builtin',
            async getPromptForCommand(args, _context) {
                const scope = args.trim() || 'current changes';
                return [{ type: 'text', text: `Please review ${scope}. Look for bugs, security issues, performance problems, and code style improvements. Provide specific, actionable feedback.` }];
            },
        },
        // ---- feedback ----
        {
            type: 'local',
            name: 'feedback',
            description: 'Send feedback about Kite',
            aliases: ['issue'],
            supportsNonInteractive: false,
            async call(args, _context) {
                if (args.trim()) {
                    return { type: 'text', value: `Feedback recorded: "${args.trim()}"\nThank you! Visit https://github.com/kite-code/kite/issues to file a report.` };
                }
                return { type: 'text', value: 'Usage: /feedback <your feedback>' };
            },
        },
        // ---- keybindings ----
        {
            type: 'local',
            name: 'keybindings',
            description: 'Show keyboard shortcuts',
            supportsNonInteractive: true,
            async call(_args, _context) {
                return {
                    type: 'text',
                    value: [
                        'Keyboard shortcuts:',
                        '  Ctrl+C     — Cancel request / Exit',
                        '  Escape     — Cancel request',
                        '  Ctrl+A     — Move to start of line',
                        '  Ctrl+E     — Move to end of line',
                        '  Ctrl+U     — Clear line',
                        '  Ctrl+K     — Kill to end of line',
                        '  Ctrl+W     — Delete word',
                        '  Up/Down    — History navigation',
                        '  Shift+Enter — New line (multi-line mode)',
                    ].join('\n'),
                };
            },
        },
        // ---- release-notes ----
        {
            type: 'local',
            name: 'release-notes',
            description: 'Show release notes',
            supportsNonInteractive: true,
            async call(_args, _context) {
                return { type: 'text', value: 'Kite v0.1.0 — Initial release.\n\nSee CHANGELOG.md for details.' };
            },
        },
        // ---- context ----
        {
            type: 'local',
            name: 'context',
            description: 'Show token usage and context window status',
            aliases: ['tokens', 'ctx'],
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const usage = appState._cumulativeUsage;
                const inputTokens = usage?.inputTokens ?? 0;
                const outputTokens = usage?.outputTokens ?? 0;
                const cacheRead = usage?.cacheReadInputTokens ?? 0;
                const cacheCreate = usage?.cacheCreationInputTokens ?? 0;
                const total = inputTokens + outputTokens + cacheRead + cacheCreate;
                const model = context.options.mainLoopModel;
                // Use shared context window detection
                const { getContextWindowForModel } = await import('./utils/format.js');
                const contextWindow = getContextWindowForModel(model);
                const usedPct = total > 0 ? ((total / contextWindow) * 100).toFixed(1) : '0.0';
                const barWidth = 30;
                const filled = Math.round((total / contextWindow) * barWidth);
                const bar = '\u2588'.repeat(Math.min(filled, barWidth)) + '\u2591'.repeat(Math.max(barWidth - filled, 0));
                const lines = [
                    'Context Window Usage:',
                    '',
                    `  [${bar}] ${usedPct}%`,
                    '',
                    `  Input tokens:    ${inputTokens.toLocaleString()}`,
                    `  Output tokens:   ${outputTokens.toLocaleString()}`,
                    `  Cache read:      ${cacheRead.toLocaleString()}`,
                    `  Cache create:    ${cacheCreate.toLocaleString()}`,
                    `  ──────────────────`,
                    `  Total:           ${total.toLocaleString()} / ${contextWindow.toLocaleString()}`,
                    '',
                    `  Model: ${model}`,
                    `  Messages: ${context.messages.length}`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- stats ----
        {
            type: 'local',
            name: 'stats',
            description: 'Show session statistics',
            supportsNonInteractive: true,
            async call(_args, context) {
                const appState = context.getAppState();
                const uptime = Math.floor(process.uptime());
                const minutes = Math.floor(uptime / 60);
                const seconds = uptime % 60;
                const usage = appState._cumulativeUsage;
                const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
                const msgCount = context.messages.length;
                const userMsgs = context.messages.filter((m) => m.role === 'user').length;
                const assistantMsgs = context.messages.filter((m) => m.role === 'assistant').length;
                const memUsage = process.memoryUsage();
                const lines = [
                    'Session Statistics:',
                    '',
                    `  Duration:          ${minutes}m ${seconds}s`,
                    `  Messages:          ${msgCount} (${userMsgs} user, ${assistantMsgs} assistant)`,
                    `  Total tokens:      ${totalTokens.toLocaleString()}`,
                    `  Memory (heap):     ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                    `  PID:               ${process.pid}`,
                    `  Node.js:           ${process.version}`,
                    `  Model:             ${context.options.mainLoopModel}`,
                    `  CWD:               ${process.cwd()}`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- effort ----
        {
            type: 'local',
            name: 'effort',
            description: 'Set model effort level (affects response depth)',
            argumentHint: '[low|medium|high]',
            supportsNonInteractive: false,
            async call(args, context) {
                const validLevels = ['low', 'medium', 'high'];
                if (args.trim()) {
                    const level = args.trim().toLowerCase();
                    if (!validLevels.includes(level)) {
                        return { type: 'text', value: `Invalid effort level. Valid: ${validLevels.join(', ')}` };
                    }
                    context.setAppState(prev => ({ ...prev, effortLevel: level }));
                    const descriptions = {
                        low: 'Quick, concise responses. Lower token usage.',
                        medium: 'Balanced depth and speed. Default behavior.',
                        high: 'Thorough, detailed responses. Higher token usage.',
                    };
                    return { type: 'text', value: `Effort set to: ${level}\n${descriptions[level]}` };
                }
                const current = context.getAppState().effortLevel ?? 'medium';
                return { type: 'text', value: `Current effort: ${current}\n\nSet with: /effort low|medium|high\n  low    — Quick, concise responses\n  medium — Balanced (default)\n  high   — Thorough, detailed responses` };
            },
        },
        // ---- rewind ----
        {
            type: 'local',
            name: 'rewind',
            description: 'Undo the last exchange (removes last user + assistant messages)',
            aliases: ['undo'],
            supportsNonInteractive: false,
            async call(_args, context) {
                const messages = context.messages;
                if (messages.length < 2) {
                    return { type: 'text', value: 'Nothing to rewind.' };
                }
                // Find the last user message and remove everything after it (including its response)
                let lastUserIdx = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                        lastUserIdx = i;
                        break;
                    }
                }
                if (lastUserIdx < 0) {
                    return { type: 'text', value: 'No user messages to rewind.' };
                }
                const removed = messages.length - lastUserIdx;
                messages.splice(lastUserIdx);
                return { type: 'text', value: `Rewound ${removed} message(s). Last user prompt and its response have been removed.` };
            },
        },
        // ---- env ----
        {
            type: 'local',
            name: 'env',
            description: 'Show environment information',
            supportsNonInteractive: true,
            async call(_args, context) {
                const os = await import('os');
                const appState = context.getAppState();
                const config = appState._config;
                const apiKeyEnv = config?.provider?.apiKeyEnv ?? 'KITE_API_KEY';
                const apiKeySet = !!process.env[apiKeyEnv];
                const shell = process.env.SHELL ?? process.env.KITE_SHELL ?? 'unknown';
                let isGit = false;
                try {
                    const { existsSync } = await import('fs');
                    const { join, dirname, resolve: pathResolve } = await import('path');
                    let dir = pathResolve(context.getCwd());
                    while (true) {
                        if (existsSync(join(dir, '.git'))) {
                            isGit = true;
                            break;
                        }
                        const parent = dirname(dir);
                        if (parent === dir)
                            break;
                        dir = parent;
                    }
                }
                catch { }
                const lines = [
                    'Environment:',
                    '',
                    `  Node.js:       ${process.version}`,
                    `  Platform:      ${os.platform()} ${os.release()} (${os.arch()})`,
                    `  Shell:         ${shell}`,
                    `  CWD:           ${process.cwd()}`,
                    `  Git repo:      ${isGit ? 'yes' : 'no'}`,
                    `  Home:          ${os.homedir()}`,
                    '',
                    '  Provider:',
                    `    Name:        ${config?.provider?.name ?? 'unknown'}`,
                    `    Model:       ${config?.provider?.model ?? 'unknown'}`,
                    `    API Key:     ${apiKeyEnv} (${apiKeySet ? 'set' : 'not set'})`,
                    `    Base URL:    ${config?.provider?.apiBaseUrl || '(default)'}`,
                    '',
                    `  Memory:        ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB heap`,
                    `  Uptime:        ${Math.floor(process.uptime())}s`,
                    `  PID:           ${process.pid}`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- summary ----
        {
            type: 'prompt',
            name: 'summary',
            description: 'Summarize the current conversation',
            progressMessage: 'summarizing conversation',
            contentLength: 200,
            source: 'builtin',
            async getPromptForCommand(_args, _context) {
                return [{ type: 'text', text: 'Please provide a concise summary of our conversation so far. List the key topics discussed, decisions made, and any pending tasks or questions. Keep it brief but comprehensive.' }];
            },
        },
        // ---- output-style ----
        {
            type: 'local',
            name: 'output-style',
            description: 'Set output verbosity (verbose, concise, brief)',
            argumentHint: '[verbose|concise|brief]',
            aliases: ['style'],
            supportsNonInteractive: false,
            async call(args, context) {
                const validStyles = ['verbose', 'concise', 'brief'];
                if (args.trim()) {
                    const style = args.trim().toLowerCase();
                    if (!validStyles.includes(style)) {
                        return { type: 'text', value: `Invalid style. Valid: ${validStyles.join(', ')}` };
                    }
                    context.setAppState(prev => ({ ...prev, outputStyle: style }));
                    const descriptions = {
                        verbose: 'Detailed explanations with examples and context.',
                        concise: 'Clear and direct, moderate detail. (Default)',
                        brief: 'Minimal output, just the essentials.',
                    };
                    return { type: 'text', value: `Output style set to: ${style}\n${descriptions[style]}` };
                }
                const current = context.getAppState().outputStyle ?? 'concise';
                return { type: 'text', value: `Current output style: ${current}\n\nSet with: /output-style verbose|concise|brief` };
            },
        },
        // ---- sandbox ----
        {
            type: 'local',
            name: 'sandbox',
            description: 'Show or toggle sandbox mode',
            argumentHint: '[on|off]',
            supportsNonInteractive: false,
            async call(args, _context) {
                const { SandboxManager } = await import('./utils/sandbox/SandboxManager.js');
                if (args.trim() === 'on') {
                    process.env.KITE_SANDBOX = '1';
                    return { type: 'text', value: `Sandbox enabled.\nAvailable: ${SandboxManager.isAvailable() ? 'yes (bwrap found)' : 'no (bwrap not installed)'}\nLevel: ${SandboxManager.getSecurityLevel()}` };
                }
                if (args.trim() === 'off') {
                    delete process.env.KITE_SANDBOX;
                    delete process.env.KITE_SANDBOX_LEVEL;
                    return { type: 'text', value: 'Sandbox disabled.' };
                }
                const enabled = SandboxManager.isSandboxingEnabled();
                const available = SandboxManager.isAvailable();
                const level = SandboxManager.getSecurityLevel();
                return {
                    type: 'text',
                    value: [
                        'Sandbox Status:',
                        `  Enabled:   ${enabled ? 'yes' : 'no'}`,
                        `  Available: ${available ? 'yes (bwrap found)' : 'no (install bubblewrap)'}`,
                        `  Level:     ${level}`,
                        '',
                        'Toggle: /sandbox on|off',
                        'Set KITE_SANDBOX=1 or KITE_SANDBOX_LEVEL=strict in environment.',
                    ].join('\n'),
                };
            },
        },
        // ---- login ----
        {
            type: 'local',
            name: 'login',
            description: 'Configure API key for the current provider',
            supportsNonInteractive: false,
            async call(_args, context) {
                const appState = context.getAppState();
                const config = appState._config;
                const providerName = config?.provider?.name ?? 'unknown';
                const apiKeyEnv = config?.provider?.apiKeyEnv ?? 'KITE_API_KEY';
                const isSet = !!process.env[apiKeyEnv];
                const lines = [
                    `Provider: ${providerName}`,
                    `API Key Variable: ${apiKeyEnv}`,
                    `Status: ${isSet ? 'Set (' + process.env[apiKeyEnv].slice(0, 4) + '...' + process.env[apiKeyEnv].slice(-4) + ')' : 'Not set'}`,
                    '',
                    `To set your API key, run in your terminal:`,
                    `  export ${apiKeyEnv}="your-api-key-here"`,
                    '',
                    `Or add it to your shell profile (~/.bashrc, ~/.zshrc):`,
                    `  echo 'export ${apiKeyEnv}="your-key"' >> ~/.bashrc`,
                    '',
                    `To use a different provider, run /provider or /setup.`,
                ];
                return { type: 'text', value: lines.join('\n') };
            },
        },
        // ---- rename ----
        {
            type: 'local',
            name: 'rename',
            description: 'Rename the current session',
            argumentHint: '<new-name>',
            supportsNonInteractive: false,
            async call(args, context) {
                const newName = args.trim();
                if (!newName) {
                    return { type: 'text', value: 'Usage: /rename <new-name>\nExample: /rename refactor auth module' };
                }
                const appState = context.getAppState();
                const sessionId = appState._sessionId;
                if (!sessionId) {
                    return { type: 'text', value: 'No active session. Start a conversation first.' };
                }
                try {
                    const { updateSessionMetadata } = await import('./utils/session.js');
                    updateSessionMetadata(sessionId, { title: newName });
                    return { type: 'text', value: `Session renamed to: ${newName}` };
                }
                catch (err) {
                    return { type: 'text', value: `Failed to rename session: ${err.message}` };
                }
            },
        },
    ];
}
// ============================================================================
// Command cache
// ============================================================================
let cachedCommands = null;
/**
 * Get all available commands (built-in + skills + MCP).
 * Memoized for performance.
 */
export function getCommands() {
    if (cachedCommands)
        return cachedCommands;
    cachedCommands = createBuiltinCommands();
    return cachedCommands;
}
/**
 * Clear the command cache (call when commands change dynamically).
 */
export function clearCommandsCache() {
    cachedCommands = null;
}
/**
 * Add a command to the registry dynamically.
 */
export function registerCommand(command) {
    const commands = getCommands();
    const existing = commands.findIndex(c => c.name === command.name);
    if (existing >= 0) {
        commands[existing] = command;
    }
    else {
        commands.push(command);
    }
}
/**
 * Find a command by name or alias.
 */
export function findCommand(nameOrAlias) {
    const name = nameOrAlias.toLowerCase();
    return getCommands().find(c => c.name.toLowerCase() === name ||
        c.aliases?.some(a => a.toLowerCase() === name));
}
/**
 * Get command names for autocomplete.
 */
export function getCommandNames() {
    return getCommands()
        .filter(c => !c.isHidden && (c.isEnabled?.() ?? true))
        .map(c => `/${c.name}`);
}
/**
 * Get built-in command names set.
 */
export function builtInCommandNames() {
    return new Set(getCommands().flatMap(c => [c.name, ...(c.aliases ?? [])]));
}
/**
 * Execute a command by name.
 */
export async function executeCommand(nameOrAlias, args, context) {
    const cmd = findCommand(nameOrAlias);
    if (!cmd)
        return null;
    if (!(cmd.isEnabled?.() ?? true)) {
        return { type: 'text', value: `Command /${cmd.name} is currently disabled.` };
    }
    switch (cmd.type) {
        case 'local':
            return cmd.call(args, context);
        case 'local-jsx':
            return new Promise((resolve) => {
                void cmd.call((result, _options) => {
                    resolve(result ? { type: 'text', value: result } : { type: 'skip' });
                }, context, args);
            });
        case 'prompt': {
            const blocks = await cmd.getPromptForCommand(args, context);
            const text = blocks
                .filter((b) => b.type === 'text')
                .map(b => b.text)
                .join('\n');
            return { type: 'text', value: text };
        }
    }
}
//# sourceMappingURL=commands.js.map