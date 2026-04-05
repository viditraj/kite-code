/**
 * Render entry point — launches the Ink application.
 *
 * Matches Claude Code's render/createRoot pattern from ink/root.ts.
 * Uses upstream ink's render() function.
 *
 * Supports four modes:
 * 1. REPL — main interactive terminal UI
 * 2. Provider setup — interactive provider configuration wizard
 * 3. Onboarding — first-run walkthrough (theme + provider + security)
 * 4. Session picker — interactive session selection for `kite -r`
 */
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { ProviderSetup } from './ProviderSetup.js';
import { Onboarding } from './Onboarding.js';
import { SessionPicker } from './SessionPicker.js';
/**
 * Launch the Ink REPL application.
 * Returns a promise that resolves when the app exits.
 */
export async function launchInkRepl(opts) {
    const instance = render(React.createElement(App, {
        provider: opts.provider,
        config: opts.config,
        initialPrompt: opts.initialPrompt,
        options: opts.options,
    }));
    await instance.waitUntilExit();
}
/**
 * Launch the provider setup wizard.
 * Returns the user's provider configuration, or null if skipped.
 */
export async function launchProviderSetup() {
    return new Promise((resolve) => {
        const instance = render(React.createElement(ProviderSetup, {
            onComplete: (result) => {
                instance.unmount();
                resolve(result);
            },
            onSkip: () => {
                instance.unmount();
                resolve(null);
            },
        }));
        instance.waitUntilExit().then(() => {
            // If the app exits without completing (e.g., Ctrl+C), resolve null
            resolve(null);
        });
    });
}
/**
 * Launch the onboarding walkthrough (theme → provider → security).
 * Returns the onboarding result or null if cancelled.
 */
export async function launchOnboarding() {
    return new Promise((resolve) => {
        const instance = render(React.createElement(Onboarding, {
            onComplete: (result) => {
                instance.unmount();
                resolve(result);
            },
        }));
        instance.waitUntilExit().then(() => {
            resolve(null);
        });
    });
}
/**
 * Launch the interactive session picker for `kite -r` without a session ID.
 * Returns the selected session metadata, or null if cancelled.
 */
export async function launchSessionPicker(initialSearchQuery) {
    return new Promise((resolve) => {
        const instance = render(React.createElement(SessionPicker, {
            onSelect: (session) => {
                instance.unmount();
                resolve(session);
            },
            onCancel: () => {
                instance.unmount();
                resolve(null);
            },
            initialSearchQuery,
        }));
        instance.waitUntilExit().then(() => {
            resolve(null);
        });
    });
}
//# sourceMappingURL=render.js.map