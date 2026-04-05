/**
 * Onboarding — first-run walkthrough for Kite Code.
 *
 * Shown once on first launch (when ~/.kite/config.json doesn't have
 * hasCompletedOnboarding: true). Guides the user through:
 *
 *   1. Welcome screen (logo)
 *   2. Theme selection
 *   3. Provider setup
 *   4. Security notes
 *
 * Mirrors Claude Code's Onboarding component architecture:
 * sequential steps array, goToNextStep(), onDone() callback.
 */
import React from 'react';
import { type ThemeName } from '../themes/themes.js';
import { type ProviderSetupResult } from './ProviderSetup.js';
export interface OnboardingResult {
    theme: ThemeName;
    providerSetup: ProviderSetupResult | null;
}
export interface OnboardingProps {
    onComplete: (result: OnboardingResult) => void;
}
export declare const Onboarding: React.FC<OnboardingProps>;
//# sourceMappingURL=Onboarding.d.ts.map