import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
import { themes } from '../themes/themes.js';
import { setActiveTheme, getActiveTheme } from '../themes/activeTheme.js';
import { saveGlobalConfig } from '../utils/config.js';
import { ProviderSetup } from './ProviderSetup.js';
// ============================================================================
// Theme label map
// ============================================================================
const THEME_OPTIONS = [
    { label: 'Dark', value: 'dark', description: 'Cyan & magenta on dark background' },
    { label: 'Light', value: 'light', description: 'Blue & magenta on light background' },
    { label: 'Dark (colorblind)', value: 'dark-colorblind', description: 'Deuteranopia-friendly dark palette' },
    { label: 'Light (colorblind)', value: 'light-colorblind', description: 'Deuteranopia-friendly light palette' },
    { label: 'Dark (ANSI only)', value: 'dark-ansi', description: 'Basic 8 ANSI colors, dark' },
    { label: 'Light (ANSI only)', value: 'light-ansi', description: 'Basic 8 ANSI colors, light' },
];
// ============================================================================
// Onboarding Component
// ============================================================================
export const Onboarding = ({ onComplete }) => {
    const { exit } = useApp();
    const [step, setStep] = useState('welcome');
    const [selectedTheme, setSelectedTheme] = useState(getActiveTheme());
    const [providerResult, setProviderResult] = useState(null);
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
        }
    });
    // Welcome → Theme
    const handleWelcomeContinue = useCallback(() => {
        setStep('theme');
    }, []);
    // Theme → Provider
    const handleThemeSelect = useCallback((item) => {
        const theme = item.value;
        setSelectedTheme(theme);
        setActiveTheme(theme);
        // Persist theme to global config immediately
        saveGlobalConfig(current => ({ ...current, theme }));
        setStep('provider');
    }, []);
    // Provider → Security
    const handleProviderComplete = useCallback((result) => {
        setProviderResult(result);
        setStep('security');
    }, []);
    const handleProviderSkip = useCallback(() => {
        setStep('security');
    }, []);
    // Security → Done
    const handleSecurityContinue = useCallback(() => {
        onComplete({
            theme: selectedTheme,
            providerSetup: providerResult,
        });
    }, [selectedTheme, providerResult, onComplete]);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [step === 'welcome' && (_jsx(WelcomeStep, { onContinue: handleWelcomeContinue })), step === 'theme' && (_jsx(ThemeStep, { currentTheme: selectedTheme, onSelect: handleThemeSelect })), step === 'provider' && (_jsx(ProviderSetup, { onComplete: handleProviderComplete, onSkip: handleProviderSkip })), step === 'security' && (_jsx(SecurityStep, { onContinue: handleSecurityContinue }))] }));
};
// ============================================================================
// Step Components
// ============================================================================
function WelcomeStep({ onContinue }) {
    useInput((_input, key) => {
        if (key.return) {
            onContinue();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Gradient, { name: "vice", children: _jsx(Text, { bold: true, children: `
  ██╗  ██╗██╗████████╗███████╗
  ██║ ██╔╝██║╚══██╔══╝██╔════╝
  █████╔╝ ██║   ██║   █████╗
  ██╔═██╗ ██║   ██║   ██╔══╝
  ██║  ██╗██║   ██║   ███████╗
  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝  CODE` }) }) }), _jsx(Text, { bold: true, children: "Welcome to Kite Code!" }), _jsx(Text, { children: "Open-source AI coding CLI \u2014 zero telemetry, any LLM provider." }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { bold: true, color: "cyan", children: "Enter" }), _jsx(Text, { dimColor: true, children: " to start setup" })] })] }));
}
function ThemeStep({ currentTheme, onSelect, }) {
    const [previewTheme, setPreviewTheme] = useState(currentTheme);
    const items = THEME_OPTIONS.map(opt => ({
        label: `${opt.label}  ${opt.value === previewTheme ? '●' : ' '}`,
        value: opt.value,
    }));
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Gradient, { name: "vice", children: _jsx(Text, { bold: true, children: '  Choose a color theme  ' }) }) }), _jsx(Text, { dimColor: true, children: "Select a theme for the terminal UI. Change later with /theme" }), _jsx(Box, { marginTop: 1, children: _jsx(SelectInput, { items: items, onSelect: onSelect, onHighlight: (item) => {
                        const name = item.value;
                        setPreviewTheme(name);
                        setActiveTheme(name);
                    } }) }), _jsxs(Box, { marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: themes[previewTheme].border, paddingX: 2, paddingY: 0, children: [_jsx(Text, { color: themes[previewTheme].primary, children: "Primary text " }), _jsx(Text, { color: themes[previewTheme].secondary, children: "Secondary text" }), _jsx(Text, { color: themes[previewTheme].success, children: "Success " }), _jsx(Text, { color: themes[previewTheme].error, children: "Error " }), _jsx(Text, { color: themes[previewTheme].warning, children: "Warning " }), _jsx(Text, { color: themes[previewTheme].muted, children: "Muted text " })] }), _jsx(Text, { dimColor: true, children: "Use arrow keys to preview, Enter to select" })] }));
}
function SecurityStep({ onContinue }) {
    useInput((_input, key) => {
        if (key.return) {
            onContinue();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Gradient, { name: "summer", children: _jsx(Text, { bold: true, children: '  Security Notes  ' }) }) }), _jsxs(Box, { flexDirection: "column", width: 70, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { children: [_jsx(Text, { bold: true, color: "yellow", children: "1." }), ' ', _jsx(Text, { bold: true, children: "AI can make mistakes" })] }) }), _jsxs(Text, { dimColor: true, wrap: "wrap", children: ['   Always review AI responses, especially when running code or ', 'making file changes.'] }), _jsx(Box, { marginY: 1, children: _jsxs(Text, { children: [_jsx(Text, { bold: true, color: "yellow", children: "2." }), ' ', _jsx(Text, { bold: true, children: "Only use with code you trust" })] }) }), _jsxs(Text, { dimColor: true, wrap: "wrap", children: ['   Due to prompt injection risks, be cautious when working with ', 'untrusted codebases or third-party content.'] }), _jsx(Box, { marginY: 1, children: _jsxs(Text, { children: [_jsx(Text, { bold: true, color: "yellow", children: "3." }), ' ', _jsx(Text, { bold: true, children: "Zero telemetry" })] }) }), _jsxs(Text, { dimColor: true, wrap: "wrap", children: ['   Kite Code collects no analytics, sends no telemetry, and makes ', 'no network requests except to your chosen LLM provider.'] })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { bold: true, color: "cyan", children: "Enter" }), _jsx(Text, { dimColor: true, children: " to start using Kite Code" })] })] }));
}
//# sourceMappingURL=Onboarding.js.map