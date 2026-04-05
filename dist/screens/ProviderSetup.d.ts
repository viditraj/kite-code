/**
 * ProviderSetup — Interactive LLM provider configuration screen.
 *
 * Shown on first launch when no kite.config.json exists, or accessible
 * via the /provider command. Lets users pick a provider, enter API details,
 * and saves the result to kite.config.json.
 *
 * Inspired by Claude Code's onboarding flow but adapted for multi-provider support.
 */
import React from 'react';
export interface ProviderSetupResult {
    providerName: string;
    model: string;
    apiKeyEnv: string;
    apiBaseUrl: string;
    verifySsl: boolean;
}
export interface ProviderSetupProps {
    onComplete: (result: ProviderSetupResult) => void;
    onSkip?: () => void;
}
export declare const ProviderSetup: React.FC<ProviderSetupProps>;
//# sourceMappingURL=ProviderSetup.d.ts.map