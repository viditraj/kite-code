import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ProviderSetup — Interactive LLM provider configuration screen.
 *
 * Shown on first launch when no kite.config.json exists, or accessible
 * via the /provider command. Lets users pick a provider, enter API details,
 * and saves the result to kite.config.json.
 *
 * Inspired by Claude Code's onboarding flow but adapted for multi-provider support.
 */
import { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
const PROVIDER_PRESETS = [
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
];
function SimpleTextInput({ value, onChange, onSubmit, placeholder = '', isActive = true, mask = false, }) {
    useInput((input, key) => {
        if (key.return) {
            onSubmit(value);
            return;
        }
        if (key.backspace || key.delete) {
            onChange(value.slice(0, -1));
            return;
        }
        if (input && !key.ctrl && !key.meta) {
            onChange(value + input);
        }
    }, { isActive });
    const displayValue = mask ? '*'.repeat(value.length) : value;
    if (value.length === 0 && placeholder) {
        return (_jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: placeholder }), _jsx(Text, { inverse: true, children: " " })] }));
    }
    return (_jsxs(Text, { children: [displayValue, _jsx(Text, { inverse: true, children: " " })] }));
}
// ============================================================================
// ProviderSetup Component
// ============================================================================
export const ProviderSetup = ({ onComplete, onSkip }) => {
    const { exit } = useApp();
    const [step, setStep] = useState('provider');
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [selectedModel, setSelectedModel] = useState('');
    const [apiKeyEnv, setApiKeyEnv] = useState('');
    const [apiBaseUrl, setApiBaseUrl] = useState('');
    const [customModel, setCustomModel] = useState('');
    // Escape to skip (if allowed)
    useInput((input, key) => {
        if (key.escape && onSkip) {
            onSkip();
        }
        if (key.ctrl && input === 'c') {
            exit();
        }
    });
    // Provider selection
    const handleProviderSelect = useCallback((item) => {
        const preset = PROVIDER_PRESETS.find(p => p.name === item.value);
        if (!preset)
            return;
        setSelectedPreset(preset);
        setApiKeyEnv(preset.apiKeyEnv);
        setApiBaseUrl(preset.apiBaseUrl);
        if (preset.models.length > 0) {
            setStep('model');
        }
        else if (preset.needsBaseUrl) {
            setStep('baseurl');
        }
        else if (preset.needsApiKey) {
            setStep('apikey');
        }
        else {
            setStep('confirm');
        }
    }, []);
    // Model selection
    const handleModelSelect = useCallback((item) => {
        if (item.value === '__custom__') {
            setCustomModel('');
            setStep('baseurl'); // reuse for custom model input
            return;
        }
        setSelectedModel(item.value);
        if (selectedPreset?.needsBaseUrl) {
            setStep('baseurl');
        }
        else if (selectedPreset?.needsApiKey) {
            setStep('apikey');
        }
        else {
            setStep('confirm');
        }
    }, [selectedPreset]);
    // Base URL submission
    const handleBaseUrlSubmit = useCallback((url) => {
        setApiBaseUrl(url);
        if (!selectedModel && customModel) {
            setSelectedModel(customModel);
        }
        if (selectedPreset?.needsApiKey) {
            setStep('apikey');
        }
        else {
            setStep('confirm');
        }
    }, [selectedPreset, selectedModel, customModel]);
    // API key env var submission
    const handleApiKeySubmit = useCallback((envVar) => {
        if (envVar.trim()) {
            setApiKeyEnv(envVar.trim());
        }
        setStep('confirm');
    }, []);
    // Confirm and complete
    const handleConfirm = useCallback(() => {
        const model = selectedModel || customModel || selectedPreset?.defaultModel || '';
        onComplete({
            providerName: selectedPreset?.name || 'custom',
            model,
            apiKeyEnv: apiKeyEnv || 'KITE_API_KEY',
            apiBaseUrl,
            verifySsl: true,
        });
    }, [selectedPreset, selectedModel, customModel, apiKeyEnv, apiBaseUrl, onComplete]);
    // ========================================================================
    // Render
    // ========================================================================
    const providerItems = PROVIDER_PRESETS.map(p => ({
        label: p.label,
        value: p.name,
    }));
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Gradient, { name: "vice", children: _jsx(Text, { bold: true, children: '  LLM Provider Setup  ' }) }) }), _jsx(Text, { dimColor: true, children: "Configure your AI model provider. You can change this later in kite.config.json" })] }), step === 'provider' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Choose a provider:" }) }), _jsx(SelectInput, { items: providerItems, onSelect: handleProviderSelect }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { dimColor: true, children: ["Use arrow keys to navigate, Enter to select", onSkip ? ', Esc to skip' : ''] }) })] })), step === 'model' && selectedPreset && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { bold: true, color: "cyan", children: ["Choose a model for ", _jsx(Text, { color: "green", children: selectedPreset.label }), ":"] }) }), _jsx(SelectInput, { items: [
                            ...selectedPreset.models.map(m => ({ label: m, value: m })),
                            { label: 'Custom model...', value: '__custom__' },
                        ], onSelect: handleModelSelect })] })), step === 'baseurl' && (_jsx(Box, { flexDirection: "column", children: selectedPreset?.name === 'custom' && !selectedModel ? (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Enter model name:" }) }), _jsxs(Box, { children: [_jsx(Text, { color: "green", children: `> ` }), _jsx(SimpleTextInput, { value: customModel, onChange: setCustomModel, onSubmit: (val) => {
                                        setSelectedModel(val);
                                        setStep('baseurl');
                                    }, placeholder: "e.g., gemma4, llama3.1-70b" })] })] })) : (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Enter API base URL:" }) }), _jsxs(Box, { children: [_jsx(Text, { color: "green", children: `> ` }), _jsx(SimpleTextInput, { value: apiBaseUrl, onChange: setApiBaseUrl, onSubmit: handleBaseUrlSubmit, placeholder: "https://your-endpoint.com/v1/chat/completions" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Enter to confirm" }) })] })) })), step === 'apikey' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "API key environment variable:" }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { dimColor: true, children: ["Kite reads your API key from an environment variable.", '\n', "Default: ", _jsx(Text, { bold: true, children: apiKeyEnv || 'KITE_API_KEY' })] }) }), _jsxs(Box, { children: [_jsx(Text, { color: "green", children: `> ` }), _jsx(SimpleTextInput, { value: apiKeyEnv, onChange: setApiKeyEnv, onSubmit: handleApiKeySubmit, placeholder: `Press Enter for ${apiKeyEnv || 'KITE_API_KEY'}` })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Enter to accept default, or type a custom env var name" }) })] })), step === 'confirm' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Gradient, { name: "summer", children: _jsx(Text, { bold: true, children: '  Configuration Summary  ' }) }) }), _jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 2, paddingY: 1, children: [_jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "Provider:  " }), _jsx(Text, { bold: true, color: "green", children: selectedPreset?.label || 'Custom' })] }), _jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "Model:     " }), _jsx(Text, { bold: true, children: selectedModel || customModel || selectedPreset?.defaultModel || '(default)' })] }), apiKeyEnv && (_jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "API Key:   " }), _jsxs(Text, { children: ["$", `{${apiKeyEnv}}`] }), process.env[apiKeyEnv] ? (_jsx(Text, { color: "green", children: " (set)" })) : (_jsx(Text, { color: "yellow", children: " (not set \u2014 set it before use)" }))] })), apiBaseUrl && (_jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "Base URL:  " }), _jsx(Text, { children: apiBaseUrl })] }))] }), _jsx(Box, { marginTop: 1, children: _jsx(SelectInput, { items: [
                                { label: 'Save and start Kite', value: 'save' },
                                { label: 'Start over', value: 'restart' },
                            ], onSelect: (item) => {
                                if (item.value === 'save') {
                                    handleConfirm();
                                }
                                else {
                                    setStep('provider');
                                    setSelectedPreset(null);
                                    setSelectedModel('');
                                    setCustomModel('');
                                    setApiKeyEnv('');
                                    setApiBaseUrl('');
                                }
                            } }) })] })), selectedPreset && step !== 'provider' && step !== 'confirm' && (_jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: _jsxs(Text, { dimColor: true, children: [selectedPreset.label, selectedModel ? ` / ${selectedModel}` : ''] }) }))] }));
};
//# sourceMappingURL=ProviderSetup.js.map