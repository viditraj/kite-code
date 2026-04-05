#!/usr/bin/env node
/**
 * Kite CLI entrypoint.
 *
 * Ported from: Claude Code's src/entrypoints/cli.tsx + src/main.tsx.
 *
 * Boot sequence:
 * 1. Parse --version, --help (instant exit via Commander)
 * 2. Load kite.config.json + ~/.kite/config.json (global config)
 * 3. First-run: show onboarding walkthrough (theme → provider → security)
 * 4. Explicit --setup: show provider setup wizard
 * 5. Resolve LLM provider
 * 6. Handle --continue / --resume (session picker if no ID given)
 * 7. If --print / -p: non-interactive mode (print and exit)
 * 8. Otherwise: launch interactive Ink REPL
 */
// Suppress Node.js warnings (TLS self-signed cert, experimental ESM, etc.)
// Must intercept at emit level — process.on('warning') doesn't prevent default printing.
const _origEmit = process.emit;
// @ts-expect-error -- overriding process.emit signature for warning suppression
process.emit = function (event, ...args) {
    if (event === 'warning') {
        const w = args[0];
        if (w && typeof w === 'object' && 'message' in w) {
            const msg = w.message;
            if (msg.includes('NODE_TLS_REJECT_UNAUTHORIZED')
                || msg.includes('ExperimentalWarning')
                || msg.includes('DeprecationWarning')) {
                return false;
            }
        }
    }
    // @ts-expect-error -- forwarding to original emit
    return _origEmit.apply(process, arguments);
};
import { Command } from 'commander';
import { loadConfig, getGlobalConfig, completeOnboarding, } from '../utils/config.js';
import { createProvider } from '../providers/factory.js';
import { bootstrapTools } from '../bootstrap/tools.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { setActiveTheme } from '../themes/activeTheme.js';
const VERSION = '0.1.0';
async function main() {
    const program = new Command()
        .name('kite')
        .description('Kite — open-source AI coding CLI. Zero telemetry, any LLM provider.')
        .version(VERSION, '-V, --version', 'Display version')
        .argument('[prompt]', 'Your prompt (starts non-interactive if combined with -p)')
        .helpOption('-h, --help', 'Display help')
        .option('-p, --print', 'Print response and exit (non-interactive)')
        .option('-c, --continue', 'Continue the most recent conversation')
        .option('-r, --resume [sessionId]', 'Resume a conversation by session ID, or open interactive picker')
        .option('--model <model>', 'Model for the current session')
        .option('--provider <provider>', 'LLM provider name')
        .option('--permission-mode <mode>', 'Permission mode (default, acceptEdits, plan, bypassPermissions)')
        .option('--system-prompt <prompt>', 'Custom system prompt')
        .option('--append-system-prompt <prompt>', 'Append to default system prompt')
        .option('--max-tokens <tokens>', 'Maximum output tokens', parseInt)
        .option('--max-budget-usd <amount>', 'Maximum session cost in USD', parseFloat)
        .option('--config <path>', 'Path to kite.config.json')
        .option('--allowed-tools <tools...>', 'Tools to allow')
        .option('--disallowed-tools <tools...>', 'Tools to deny')
        .option('--mcp-config <configs...>', 'MCP server config files')
        .option('-d, --debug [filter]', 'Enable debug logging')
        .option('--verbose', 'Verbose output')
        .option('--bare', 'Minimal mode: skip hooks, plugins, auto-memory')
        .option('--doctor', 'Run system diagnostics')
        .option('--setup', 'Launch provider setup wizard');
    program.action(async (prompt, options) => {
        // Bootstrap all built-in tools
        bootstrapTools();
        // Load project/global config
        const config = loadConfig(options.config);
        // Apply CLI overrides
        if (options.model)
            config.provider.model = options.model;
        if (options.provider)
            config.provider.name = options.provider;
        if (options.permissionMode)
            config.behavior.permissionMode = options.permissionMode;
        if (options.maxTokens)
            config.behavior.maxTokens = options.maxTokens;
        if (options.maxBudgetUsd)
            config.behavior.maxCostUsd = options.maxBudgetUsd;
        // Restore saved theme from global config
        const globalConfig = getGlobalConfig();
        if (globalConfig.theme) {
            setActiveTheme(globalConfig.theme);
        }
        // Doctor mode
        if (options.doctor) {
            await runDoctor(config);
            return;
        }
        // ──────────────────────────────────────────────────────────────────
        // First-run onboarding (mirrors Claude Code's showSetupScreens)
        //
        // Triggered when:
        //   - No theme set in global config, OR
        //   - hasCompletedOnboarding is falsy
        // Skipped when:
        //   - Non-interactive (-p / --print)
        //   - Not a TTY
        //   - Explicit --setup (handled separately below)
        //   - --bare mode
        // ──────────────────────────────────────────────────────────────────
        const isInteractive = !options.print && process.stdout.isTTY && !options.bare;
        const needsOnboarding = !globalConfig.theme || !globalConfig.hasCompletedOnboarding;
        if (isInteractive && needsOnboarding && !options.setup) {
            const onboardingResult = await runOnboarding(config);
            if (onboardingResult) {
                // Apply provider setup result from onboarding
                if (onboardingResult.providerSetup) {
                    config.provider.name = onboardingResult.providerSetup.providerName;
                    config.provider.model = onboardingResult.providerSetup.model;
                    config.provider.apiKeyEnv = onboardingResult.providerSetup.apiKeyEnv;
                    config.provider.apiBaseUrl = onboardingResult.providerSetup.apiBaseUrl;
                    config.provider.verifySsl = onboardingResult.providerSetup.verifySsl;
                    // Save provider to project kite.config.json
                    saveConfigFile(config);
                }
                // Mark onboarding complete
                completeOnboarding();
            }
        }
        // ──────────────────────────────────────────────────────────────────
        // Explicit --setup: show just the provider setup wizard
        // (separate from onboarding — for reconfiguration)
        // ──────────────────────────────────────────────────────────────────
        if (options.setup) {
            const setupResult = await runProviderSetup(config);
            if (setupResult) {
                config.provider.name = setupResult.providerName;
                config.provider.model = setupResult.model;
                config.provider.apiKeyEnv = setupResult.apiKeyEnv;
                config.provider.apiBaseUrl = setupResult.apiBaseUrl;
                config.provider.verifySsl = setupResult.verifySsl;
                saveConfigFile(config);
            }
            else {
                return; // User cancelled --setup
            }
        }
        // Create provider
        const provider = createProvider(config);
        // ──────────────────────────────────────────────────────────────────
        // Session resume: --continue or --resume [id]
        //
        // Mirrors Claude Code's resume flow:
        //   --continue    → load most recent session
        //   --resume <id> → load specific session by ID
        //   --resume      → open interactive session picker
        //   --resume <q>  → open session picker with search query
        // ──────────────────────────────────────────────────────────────────
        if (options.continue || options.resume) {
            const resumed = await handleSessionResume(options, config);
            if (!resumed)
                return; // User cancelled or no sessions found
            // Clear screen so resumed conversation starts fresh
            if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[H');
            }
            // Pass resumed data through options
            options._resumedMessages = resumed.messages;
            options._resumedSessionId = resumed.sessionId;
        }
        // Non-interactive (print) mode
        if (options.print && prompt) {
            await runPrintMode(provider, config, prompt, options);
            return;
        }
        // Interactive REPL mode
        await runInteractive(provider, config, prompt, options);
    });
    await program.parseAsync(process.argv);
}
// ============================================================================
// Onboarding
// ============================================================================
/**
 * Run the first-run onboarding walkthrough.
 * Returns the result (theme + provider config) or null if cancelled.
 */
async function runOnboarding(config) {
    if (!process.stdout.isTTY)
        return null;
    try {
        const { launchOnboarding } = await import('../screens/render.js');
        return await launchOnboarding();
    }
    catch (err) {
        console.error('Onboarding failed:', err.message);
        return null;
    }
}
// ============================================================================
// Session Resume
// ============================================================================
/**
 * Handle --continue and --resume session resume flows.
 *
 * Returns { messages, sessionId } if a session was loaded, or null to cancel.
 */
async function handleSessionResume(options, _config) {
    const { listSessions, loadSession } = await import('../utils/session.js');
    // --continue: load most recent session
    if (options.continue) {
        const sessions = listSessions(1);
        if (sessions.length === 0) {
            console.log('No previous sessions found.');
            return null;
        }
        const saved = loadSession(sessions[0].id);
        if (!saved) {
            console.log('Failed to load most recent session.');
            return null;
        }
        return { messages: saved.messages, sessionId: saved.metadata.id };
    }
    // --resume with a session ID (string that isn't boolean 'true')
    const resumeValue = options.resume;
    if (typeof resumeValue === 'string' && resumeValue !== 'true') {
        // Try as session ID first
        const saved = loadSession(resumeValue);
        if (saved) {
            return { messages: saved.messages, sessionId: saved.metadata.id };
        }
        // Not a valid session ID — try as title search, then fall through to picker
        const { findSessionByTitle } = await import('../utils/session.js');
        const match = findSessionByTitle(resumeValue);
        if (match) {
            const saved2 = loadSession(match.id);
            if (saved2) {
                return { messages: saved2.messages, sessionId: saved2.metadata.id };
            }
        }
        // Fall through to interactive picker with search query
        if (process.stdout.isTTY) {
            return await showSessionPicker(resumeValue);
        }
        console.log(`Session "${resumeValue}" not found.`);
        return null;
    }
    // --resume with no value: show interactive picker
    if (process.stdout.isTTY) {
        return await showSessionPicker();
    }
    // Non-TTY fallback: try most recent
    const sessions = listSessions(1);
    if (sessions.length === 0) {
        console.log('No previous sessions found.');
        return null;
    }
    const saved = loadSession(sessions[0].id);
    if (!saved)
        return null;
    return { messages: saved.messages, sessionId: saved.metadata.id };
}
/**
 * Show the interactive session picker UI.
 * Returns selected session data or null if cancelled.
 */
async function showSessionPicker(searchQuery) {
    try {
        const { launchSessionPicker } = await import('../screens/render.js');
        const { loadSession } = await import('../utils/session.js');
        const selected = await launchSessionPicker(searchQuery);
        if (!selected)
            return null;
        const saved = loadSession(selected.id);
        if (!saved) {
            console.log(`Failed to load session ${selected.id}.`);
            return null;
        }
        return { messages: saved.messages, sessionId: saved.metadata.id };
    }
    catch (err) {
        console.error('Session picker failed:', err.message);
        return null;
    }
}
// ============================================================================
// Non-interactive (print) mode
// ============================================================================
/**
 * Non-interactive mode: send prompt, execute tools, stream response, exit.
 *
 * Uses QueryEngine for proper tool execution (not raw provider.chat).
 * Ported from: Claude Code's -p/--print mode in main.tsx.
 */
async function runPrintMode(provider, config, prompt, options) {
    const { getSystemPrompt } = await import('../constants/prompts.js');
    const { QueryEngine } = await import('../QueryEngine.js');
    const { getAllBaseTools } = await import('../tools.js');
    const { createEmptyToolPermissionContext } = await import('../types/permissions.js');
    const { bootstrapMCPTools, shutdownMCP } = await import('../bootstrap/mcp.js');
    // Connect MCP servers and merge with built-in tools
    const { tools } = await bootstrapMCPTools(process.cwd());
    const toolNames = tools.map(t => t.name);
    const systemPrompt = options.systemPrompt || getSystemPrompt(config.provider.model, toolNames);
    const permissionContext = {
        ...createEmptyToolPermissionContext(),
        mode: (config.behavior.permissionMode ?? 'default'),
    };
    const engine = new QueryEngine({
        provider,
        tools,
        model: config.provider.model,
        maxTokens: config.behavior.maxTokens,
        systemPrompt,
        cwd: process.cwd(),
        isNonInteractiveSession: true,
        permissionContext,
    });
    // Store provider for tools that need it
    engine['appState']._provider = provider;
    engine['appState']._permissionContext = permissionContext;
    const gen = engine.run(prompt);
    let result = await gen.next();
    while (!result.done) {
        const event = result.value;
        if (event.type === 'text_delta') {
            process.stdout.write(event.text);
        }
        else if (event.type === 'error') {
            process.stderr.write(`\nError: ${event.message}\n`);
            process.exit(1);
        }
        // Tool results handled internally by QueryEngine
        result = await gen.next();
    }
    process.stdout.write('\n');
}
// ============================================================================
// Interactive REPL
// ============================================================================
/**
 * Interactive REPL mode: launch the Ink terminal UI.
 *
 * Ported from: Claude Code's launchRepl in replLauncher.tsx.
 * Uses the full Ink-based REPL screen with streaming, permissions, and slash commands.
 * Falls back to readline REPL if Ink fails to initialize (e.g., non-TTY environments).
 */
async function runInteractive(provider, config, initialPrompt, options) {
    // Try Ink REPL first (full UI with components)
    if (process.stdout.isTTY) {
        try {
            const { launchInkRepl } = await import('../screens/render.js');
            await launchInkRepl({ provider, config, initialPrompt, options });
            return;
        }
        catch (err) {
            // Log the error so we can debug Ink failures
            console.error('Ink REPL failed to start:', err.message);
            console.error('Falling back to readline REPL...');
            console.error();
        }
    }
    // Fallback: readline REPL for non-TTY or when Ink unavailable
    const { createReadlineRepl } = await import('../screens/readlineRepl.js');
    await createReadlineRepl(provider, config, initialPrompt, options);
}
// ============================================================================
// Doctor mode
// ============================================================================
/**
 * Doctor mode: print system diagnostics.
 */
async function runDoctor(config) {
    const os = await import('os');
    const chalk = (await import('chalk')).default;
    console.log(chalk.bold('\n  Kite Doctor\n'));
    console.log(`  Node.js:  ${process.version}`);
    console.log(`  Platform: ${os.platform()} ${os.release()}`);
    console.log(`  Arch:     ${os.arch()}`);
    console.log(`  CWD:      ${process.cwd()}`);
    console.log();
    console.log(chalk.bold('  Provider:'));
    console.log(`    Name:   ${config.provider.name}`);
    console.log(`    Model:  ${config.provider.model}`);
    console.log(`    API:    ${config.provider.apiBaseUrl || '(default)'}`);
    console.log();
    console.log(chalk.bold('  Config:'));
    console.log(`    File:   ${config.configPath || '(none found)'}`);
    console.log(`    Mode:   ${config.behavior.permissionMode}`);
    console.log(`    Tokens: ${config.behavior.maxTokens}`);
    console.log();
    // Check API key
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey(config);
    console.log(chalk.bold('  API Key:'));
    if (apiKey) {
        const masked = apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
        console.log(`    ${config.provider.apiKeyEnv}: ${masked}`);
    }
    else {
        console.log(chalk.yellow(`    ${config.provider.apiKeyEnv}: (not set)`));
    }
    console.log();
    // Test connectivity
    console.log(chalk.bold('  Connectivity:'));
    try {
        const provider = createProvider(config);
        const testResponse = provider.chat({
            model: config.provider.model,
            messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
            maxTokens: 10,
            stream: true,
        });
        let gotResponse = false;
        for await (const event of testResponse) {
            if (event.type === 'text_delta' || event.type === 'thinking_delta' || event.type === 'message_end') {
                gotResponse = true;
                break;
            }
            if (event.type === 'error') {
                console.log(chalk.red(`    x ${event.message}`));
                gotResponse = true; // Don't fall through to the "no response" case
                break;
            }
        }
        if (gotResponse) {
            console.log(chalk.green(`    ok Connected to ${config.provider.name} (${config.provider.model})`));
        }
        else {
            console.log(chalk.yellow(`    ? No response received`));
        }
    }
    catch (err) {
        console.log(chalk.red(`    x Connection failed: ${err}`));
    }
    console.log();
}
// ============================================================================
// Provider Setup (standalone --setup)
// ============================================================================
/**
 * Run the interactive provider setup wizard.
 * Returns the result or null if skipped/cancelled.
 */
async function runProviderSetup(config) {
    if (!process.stdout.isTTY)
        return null;
    try {
        const { launchProviderSetup } = await import('../screens/render.js');
        return await launchProviderSetup();
    }
    catch (err) {
        console.error('Provider setup failed:', err.message);
        return null;
    }
}
// ============================================================================
// Config file save
// ============================================================================
/**
 * Save the current config to kite.config.json in the current directory.
 */
function saveConfigFile(config) {
    const configData = {
        provider: {
            name: config.provider.name,
            model: config.provider.model,
            apiKeyEnv: config.provider.apiKeyEnv,
            ...(config.provider.apiBaseUrl ? { apiBaseUrl: config.provider.apiBaseUrl } : {}),
            ...(config.provider.verifySsl === false ? { verifySsl: false } : {}),
            ...(config.provider.extraHeaders ? { extraHeaders: config.provider.extraHeaders } : {}),
            ...(config.provider.extraPayload ? { extraPayload: config.provider.extraPayload } : {}),
        },
        behavior: {
            permissionMode: config.behavior.permissionMode,
            maxTokens: config.behavior.maxTokens,
        },
    };
    const filePath = join(process.cwd(), 'kite.config.json');
    try {
        writeFileSync(filePath, JSON.stringify(configData, null, 2) + '\n', 'utf-8');
        console.log(`\nConfiguration saved to ${filePath}\n`);
    }
    catch (err) {
        console.error(`Failed to save config: ${err.message}`);
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map