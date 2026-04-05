/**
 * ProviderSetup — Interactive LLM provider configuration screen.
 *
 * Shown on first launch when no kite.config.json exists, or accessible
 * via the /provider command. Lets users pick a provider, enter API details,
 * and saves the result to kite.config.json.
 *
 * Inspired by Claude Code's onboarding flow but adapted for multi-provider support.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import SelectInput from 'ink-select-input'
import Gradient from 'ink-gradient'

// ============================================================================
// Types
// ============================================================================

export interface ProviderSetupResult {
  providerName: string
  model: string
  apiKeyEnv: string
  apiBaseUrl: string
  verifySsl: boolean
}

export interface ProviderSetupProps {
  onComplete: (result: ProviderSetupResult) => void
  onSkip?: () => void
}

type Step = 'provider' | 'model' | 'apikey' | 'baseurl' | 'confirm'

// ============================================================================
// Provider Presets
// ============================================================================

interface ProviderPreset {
  name: string
  label: string
  description: string
  defaultModel: string
  models: string[]
  apiKeyEnv: string
  apiBaseUrl: string
  needsApiKey: boolean
  needsBaseUrl: boolean
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'Claude Sonnet, Opus, Haiku — requires ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-5-20241022'],
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'openai',
    label: 'OpenAI (GPT)',
    description: 'GPT-4o, o1, o3 — requires OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3'],
    apiKeyEnv: 'OPENAI_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'ollama',
    label: 'Ollama (Local)',
    description: 'Run models locally — no API key needed',
    defaultModel: 'llama3.1',
    models: ['llama3.1', 'llama3.1:70b', 'codellama', 'mistral', 'mixtral', 'deepseek-coder-v2'],
    apiKeyEnv: '',
    apiBaseUrl: 'http://localhost:11434',
    needsApiKey: false,
    needsBaseUrl: false,
  },
  {
    name: 'groq',
    label: 'Groq',
    description: 'Ultra-fast inference — requires GROQ_API_KEY',
    defaultModel: 'llama-3.1-70b-versatile',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    apiKeyEnv: 'GROQ_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek Chat/Coder — requires DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder'],
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral models — requires MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'],
    apiKeyEnv: 'MISTRAL_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    description: 'Access many models via one API — requires OPENROUTER_API_KEY',
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    models: ['anthropic/claude-sonnet-4-20250514', 'openai/gpt-4o', 'google/gemini-2.0-flash', 'meta-llama/llama-3.1-70b-instruct'],
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: false,
  },
  {
    name: 'custom',
    label: 'Custom / Self-Hosted',
    description: 'Any OpenAI-compatible endpoint',
    defaultModel: '',
    models: [],
    apiKeyEnv: 'KITE_API_KEY',
    apiBaseUrl: '',
    needsApiKey: true,
    needsBaseUrl: true,
  },
]

// ============================================================================
// TextInput (inline, minimal)
// ============================================================================

interface SimpleTextInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder?: string
  isActive?: boolean
  mask?: boolean
}

function SimpleTextInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  isActive = true,
  mask = false,
}: SimpleTextInputProps): React.ReactElement {
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit(value)
        return
      }
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        onChange(value + input)
      }
    },
    { isActive },
  )

  const displayValue = mask ? '*'.repeat(value.length) : value

  if (value.length === 0 && placeholder) {
    return (
      <Text>
        <Text dimColor>{placeholder}</Text>
        <Text inverse> </Text>
      </Text>
    )
  }

  return (
    <Text>
      {displayValue}
      <Text inverse> </Text>
    </Text>
  )
}

// ============================================================================
// ProviderSetup Component
// ============================================================================

export const ProviderSetup: React.FC<ProviderSetupProps> = ({ onComplete, onSkip }) => {
  const { exit } = useApp()
  const [step, setStep] = useState<Step>('provider')
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [apiKeyEnv, setApiKeyEnv] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [customModel, setCustomModel] = useState('')

  // Escape to skip (if allowed)
  useInput((input, key) => {
    if (key.escape && onSkip) {
      onSkip()
    }
    if (key.ctrl && input === 'c') {
      exit()
    }
  })

  // Provider selection
  const handleProviderSelect = useCallback((item: { value: string }) => {
    const preset = PROVIDER_PRESETS.find(p => p.name === item.value)
    if (!preset) return
    setSelectedPreset(preset)
    setApiKeyEnv(preset.apiKeyEnv)
    setApiBaseUrl(preset.apiBaseUrl)

    if (preset.models.length > 0) {
      setStep('model')
    } else if (preset.needsBaseUrl) {
      setStep('baseurl')
    } else if (preset.needsApiKey) {
      setStep('apikey')
    } else {
      setStep('confirm')
    }
  }, [])

  // Model selection
  const handleModelSelect = useCallback((item: { value: string }) => {
    if (item.value === '__custom__') {
      setCustomModel('')
      setStep('baseurl') // reuse for custom model input
      return
    }
    setSelectedModel(item.value)
    if (selectedPreset?.needsBaseUrl) {
      setStep('baseurl')
    } else if (selectedPreset?.needsApiKey) {
      setStep('apikey')
    } else {
      setStep('confirm')
    }
  }, [selectedPreset])

  // Base URL submission
  const handleBaseUrlSubmit = useCallback((url: string) => {
    setApiBaseUrl(url)
    if (!selectedModel && customModel) {
      setSelectedModel(customModel)
    }
    if (selectedPreset?.needsApiKey) {
      setStep('apikey')
    } else {
      setStep('confirm')
    }
  }, [selectedPreset, selectedModel, customModel])

  // API key env var submission
  const handleApiKeySubmit = useCallback((envVar: string) => {
    if (envVar.trim()) {
      setApiKeyEnv(envVar.trim())
    }
    setStep('confirm')
  }, [])

  // Confirm and complete
  const handleConfirm = useCallback(() => {
    const model = selectedModel || customModel || selectedPreset?.defaultModel || ''
    onComplete({
      providerName: selectedPreset?.name || 'custom',
      model,
      apiKeyEnv: apiKeyEnv || 'KITE_API_KEY',
      apiBaseUrl,
      verifySsl: true,
    })
  }, [selectedPreset, selectedModel, customModel, apiKeyEnv, apiBaseUrl, onComplete])

  // ========================================================================
  // Render
  // ========================================================================

  const providerItems = PROVIDER_PRESETS.map(p => ({
    label: p.label,
    value: p.name,
  }))

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Gradient name="vice">
            <Text bold>{'  LLM Provider Setup  '}</Text>
          </Gradient>
        </Box>
        <Text dimColor>Configure your AI model provider. You can change this later in kite.config.json</Text>
      </Box>

      {/* Step: Provider Selection */}
      {step === 'provider' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="cyan">Choose a provider:</Text>
          </Box>
          <SelectInput
            items={providerItems}
            onSelect={handleProviderSelect}
          />
          <Box marginTop={1}>
            <Text dimColor>Use arrow keys to navigate, Enter to select{onSkip ? ', Esc to skip' : ''}</Text>
          </Box>
        </Box>
      )}

      {/* Step: Model Selection */}
      {step === 'model' && selectedPreset && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="cyan">
              Choose a model for <Text color="green">{selectedPreset.label}</Text>:
            </Text>
          </Box>
          <SelectInput
            items={[
              ...selectedPreset.models.map(m => ({ label: m, value: m })),
              { label: 'Custom model...', value: '__custom__' },
            ]}
            onSelect={handleModelSelect}
          />
        </Box>
      )}

      {/* Step: Base URL (or custom model for custom provider) */}
      {step === 'baseurl' && (
        <Box flexDirection="column">
          {selectedPreset?.name === 'custom' && !selectedModel ? (
            <>
              <Box marginBottom={1}>
                <Text bold color="cyan">Enter model name:</Text>
              </Box>
              <Box>
                <Text color="green">{`> `}</Text>
                <SimpleTextInput
                  value={customModel}
                  onChange={setCustomModel}
                  onSubmit={(val) => {
                    setSelectedModel(val)
                    setStep('baseurl')
                  }}
                  placeholder="e.g., gemma4, llama3.1-70b"
                />
              </Box>
            </>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text bold color="cyan">Enter API base URL:</Text>
              </Box>
              <Box>
                <Text color="green">{`> `}</Text>
                <SimpleTextInput
                  value={apiBaseUrl}
                  onChange={setApiBaseUrl}
                  onSubmit={handleBaseUrlSubmit}
                  placeholder="https://your-endpoint.com/v1/chat/completions"
                />
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Press Enter to confirm</Text>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Step: API Key Env Var */}
      {step === 'apikey' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="cyan">API key environment variable:</Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor>
              Kite reads your API key from an environment variable.{'\n'}
              Default: <Text bold>{apiKeyEnv || 'KITE_API_KEY'}</Text>
            </Text>
          </Box>
          <Box>
            <Text color="green">{`> `}</Text>
            <SimpleTextInput
              value={apiKeyEnv}
              onChange={setApiKeyEnv}
              onSubmit={handleApiKeySubmit}
              placeholder={`Press Enter for ${apiKeyEnv || 'KITE_API_KEY'}`}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to accept default, or type a custom env var name</Text>
          </Box>
        </Box>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Gradient name="summer">
              <Text bold>{'  Configuration Summary  '}</Text>
            </Gradient>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
            <Text>
              <Text dimColor>Provider:  </Text>
              <Text bold color="green">{selectedPreset?.label || 'Custom'}</Text>
            </Text>
            <Text>
              <Text dimColor>Model:     </Text>
              <Text bold>{selectedModel || customModel || selectedPreset?.defaultModel || '(default)'}</Text>
            </Text>
            {apiKeyEnv && (
              <Text>
                <Text dimColor>API Key:   </Text>
                <Text>${`{${apiKeyEnv}}`}</Text>
                {process.env[apiKeyEnv] ? (
                  <Text color="green"> (set)</Text>
                ) : (
                  <Text color="yellow"> (not set — set it before use)</Text>
                )}
              </Text>
            )}
            {apiBaseUrl && (
              <Text>
                <Text dimColor>Base URL:  </Text>
                <Text>{apiBaseUrl}</Text>
              </Text>
            )}
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Save and start Kite', value: 'save' },
                { label: 'Start over', value: 'restart' },
              ]}
              onSelect={(item) => {
                if (item.value === 'save') {
                  handleConfirm()
                } else {
                  setStep('provider')
                  setSelectedPreset(null)
                  setSelectedModel('')
                  setCustomModel('')
                  setApiKeyEnv('')
                  setApiBaseUrl('')
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Current selection breadcrumb */}
      {selectedPreset && step !== 'provider' && step !== 'confirm' && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            {selectedPreset.label}
            {selectedModel ? ` / ${selectedModel}` : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}
