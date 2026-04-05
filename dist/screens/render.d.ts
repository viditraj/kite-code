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
import { type ProviderSetupResult } from './ProviderSetup.js';
import { type OnboardingResult } from './Onboarding.js';
import type { SessionMetadata } from '../utils/session.js';
import type { LLMProvider } from '../providers/types.js';
import type { KiteConfig } from '../utils/config.js';
export interface LaunchOptions {
    provider: LLMProvider;
    config: KiteConfig;
    initialPrompt?: string;
    options: Record<string, unknown>;
}
/**
 * Launch the Ink REPL application.
 * Returns a promise that resolves when the app exits.
 */
export declare function launchInkRepl(opts: LaunchOptions): Promise<void>;
/**
 * Launch the provider setup wizard.
 * Returns the user's provider configuration, or null if skipped.
 */
export declare function launchProviderSetup(): Promise<ProviderSetupResult | null>;
/**
 * Launch the onboarding walkthrough (theme → provider → security).
 * Returns the onboarding result or null if cancelled.
 */
export declare function launchOnboarding(): Promise<OnboardingResult | null>;
/**
 * Launch the interactive session picker for `kite -r` without a session ID.
 * Returns the selected session metadata, or null if cancelled.
 */
export declare function launchSessionPicker(initialSearchQuery?: string): Promise<SessionMetadata | null>;
//# sourceMappingURL=render.d.ts.map