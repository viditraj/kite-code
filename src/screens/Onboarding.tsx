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

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import SelectInput from 'ink-select-input'
import Gradient from 'ink-gradient'
import { themeNames, type ThemeName, themes } from '../themes/themes.js'
import { setActiveTheme, getActiveTheme } from '../themes/activeTheme.js'
import { saveGlobalConfig } from '../utils/config.js'
import { ProviderSetup, type ProviderSetupResult } from './ProviderSetup.js'

// ============================================================================
// Types
// ============================================================================

export interface OnboardingResult {
  theme: ThemeName
  providerSetup: ProviderSetupResult | null
}

export interface OnboardingProps {
  onComplete: (result: OnboardingResult) => void
}

type Step = 'welcome' | 'theme' | 'provider' | 'security'

// ============================================================================
// Theme label map
// ============================================================================

const THEME_OPTIONS: Array<{ label: string; value: ThemeName; description: string }> = [
  { label: 'Dark', value: 'dark', description: 'Cyan & magenta on dark background' },
  { label: 'Light', value: 'light', description: 'Blue & magenta on light background' },
  { label: 'Dark (colorblind)', value: 'dark-colorblind', description: 'Deuteranopia-friendly dark palette' },
  { label: 'Light (colorblind)', value: 'light-colorblind', description: 'Deuteranopia-friendly light palette' },
  { label: 'Dark (ANSI only)', value: 'dark-ansi', description: 'Basic 8 ANSI colors, dark' },
  { label: 'Light (ANSI only)', value: 'light-ansi', description: 'Basic 8 ANSI colors, light' },
]

// ============================================================================
// Onboarding Component
// ============================================================================

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { exit } = useApp()
  const [step, setStep] = useState<Step>('welcome')
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(getActiveTheme())
  const [providerResult, setProviderResult] = useState<ProviderSetupResult | null>(null)

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
    }
  })

  // Welcome → Theme
  const handleWelcomeContinue = useCallback(() => {
    setStep('theme')
  }, [])

  // Theme → Provider
  const handleThemeSelect = useCallback((item: { value: string }) => {
    const theme = item.value as ThemeName
    setSelectedTheme(theme)
    setActiveTheme(theme)
    // Persist theme to global config immediately
    saveGlobalConfig(current => ({ ...current, theme }))
    setStep('provider')
  }, [])

  // Provider → Security
  const handleProviderComplete = useCallback((result: ProviderSetupResult) => {
    setProviderResult(result)
    setStep('security')
  }, [])

  const handleProviderSkip = useCallback(() => {
    setStep('security')
  }, [])

  // Security → Done
  const handleSecurityContinue = useCallback(() => {
    onComplete({
      theme: selectedTheme,
      providerSetup: providerResult,
    })
  }, [selectedTheme, providerResult, onComplete])

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Step 1: Welcome */}
      {step === 'welcome' && (
        <WelcomeStep onContinue={handleWelcomeContinue} />
      )}

      {/* Step 2: Theme Selection */}
      {step === 'theme' && (
        <ThemeStep
          currentTheme={selectedTheme}
          onSelect={handleThemeSelect}
        />
      )}

      {/* Step 3: Provider Setup */}
      {step === 'provider' && (
        <ProviderSetup
          onComplete={handleProviderComplete}
          onSkip={handleProviderSkip}
        />
      )}

      {/* Step 4: Security Notes */}
      {step === 'security' && (
        <SecurityStep onContinue={handleSecurityContinue} />
      )}
    </Box>
  )
}

// ============================================================================
// Step Components
// ============================================================================

function WelcomeStep({ onContinue }: { onContinue: () => void }): React.ReactElement {
  useInput((_input, key) => {
    if (key.return) {
      onContinue()
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Gradient name="vice">
          <Text bold>
            {`
  ██╗  ██╗██╗████████╗███████╗
  ██║ ██╔╝██║╚══██╔══╝██╔════╝
  █████╔╝ ██║   ██║   █████╗
  ██╔═██╗ ██║   ██║   ██╔══╝
  ██║  ██╗██║   ██║   ███████╗
  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝  CODE`}
          </Text>
        </Gradient>
      </Box>
      <Text bold>Welcome to Kite Code!</Text>
      <Text>
        Open-source AI coding CLI — zero telemetry, any LLM provider.
      </Text>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text bold color="cyan">Enter</Text>
        <Text dimColor> to start setup</Text>
      </Box>
    </Box>
  )
}

function ThemeStep({
  currentTheme,
  onSelect,
}: {
  currentTheme: ThemeName
  onSelect: (item: { value: string }) => void
}): React.ReactElement {
  const [previewTheme, setPreviewTheme] = useState<ThemeName>(currentTheme)

  const items = THEME_OPTIONS.map(opt => ({
    label: `${opt.label}  ${opt.value === previewTheme ? '●' : ' '}`,
    value: opt.value,
  }))

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Gradient name="vice">
          <Text bold>{'  Choose a color theme  '}</Text>
        </Gradient>
      </Box>
      <Text dimColor>Select a theme for the terminal UI. Change later with /theme</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={onSelect}
          onHighlight={(item) => {
            const name = item.value as ThemeName
            setPreviewTheme(name)
            setActiveTheme(name)
          }}
        />
      </Box>
      {/* Live preview swatch */}
      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={themes[previewTheme].border} paddingX={2} paddingY={0}>
        <Text color={themes[previewTheme].primary}>Primary text </Text>
        <Text color={themes[previewTheme].secondary}>Secondary text</Text>
        <Text color={themes[previewTheme].success}>Success </Text>
        <Text color={themes[previewTheme].error}>Error </Text>
        <Text color={themes[previewTheme].warning}>Warning </Text>
        <Text color={themes[previewTheme].muted}>Muted text </Text>
      </Box>
      <Text dimColor>Use arrow keys to preview, Enter to select</Text>
    </Box>
  )
}

function SecurityStep({ onContinue }: { onContinue: () => void }): React.ReactElement {
  useInput((_input, key) => {
    if (key.return) {
      onContinue()
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Gradient name="summer">
          <Text bold>{'  Security Notes  '}</Text>
        </Gradient>
      </Box>
      <Box flexDirection="column" width={70}>
        <Box marginBottom={1}>
          <Text>
            <Text bold color="yellow">1.</Text>{' '}
            <Text bold>AI can make mistakes</Text>
          </Text>
        </Box>
        <Text dimColor wrap="wrap">
          {'   Always review AI responses, especially when running code or '}
          {'making file changes.'}
        </Text>
        <Box marginY={1}>
          <Text>
            <Text bold color="yellow">2.</Text>{' '}
            <Text bold>Only use with code you trust</Text>
          </Text>
        </Box>
        <Text dimColor wrap="wrap">
          {'   Due to prompt injection risks, be cautious when working with '}
          {'untrusted codebases or third-party content.'}
        </Text>
        <Box marginY={1}>
          <Text>
            <Text bold color="yellow">3.</Text>{' '}
            <Text bold>Zero telemetry</Text>
          </Text>
        </Box>
        <Text dimColor wrap="wrap">
          {'   Kite Code collects no analytics, sends no telemetry, and makes '}
          {'no network requests except to your chosen LLM provider.'}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text bold color="cyan">Enter</Text>
        <Text dimColor> to start using Kite Code</Text>
      </Box>
    </Box>
  )
}
