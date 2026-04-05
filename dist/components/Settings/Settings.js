import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Settings — tabbed settings dialog with system status, configuration,
 * and usage statistics.
 *
 * Provides diagnostics, config introspection, and token/cost tracking
 * in a navigable multi-tab layout.
 */
import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
// ============================================================================
// Constants
// ============================================================================
const TABS = ['status', 'config', 'usage'];
const TAB_LABELS = {
    status: 'Status',
    config: 'Config',
    usage: 'Usage',
};
const STATUS_ICONS = {
    ok: '✓',
    warning: '⚠',
    error: '✗',
};
const STATUS_COLORS = {
    ok: 'green',
    warning: 'yellow',
    error: 'red',
};
// ============================================================================
// Helpers
// ============================================================================
/**
 * Format bytes into a human-readable string (e.g. "45.2 MB").
 */
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
/**
 * Format seconds into a human-readable duration string.
 */
function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (hrs > 0)
        parts.push(`${hrs}h`);
    if (mins > 0)
        parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}
/**
 * Format a number with commas for readability.
 */
function formatNumber(n) {
    return n.toLocaleString('en-US');
}
/**
 * Parse major version from a Node version string like "v20.11.0".
 */
function parseNodeMajor(version) {
    const match = version.match(/^v?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}
/**
 * Attempt to get the git version string. Returns null on failure.
 */
function getGitVersion() {
    try {
        const output = execSync('git --version', {
            encoding: 'utf-8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim();
    }
    catch {
        return null;
    }
}
// ============================================================================
// buildDiagnostics
// ============================================================================
/**
 * Build an array of system diagnostic items for the status tab.
 */
export function buildDiagnostics() {
    const diagnostics = [];
    // Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseNodeMajor(nodeVersion);
    diagnostics.push({
        label: 'Node.js',
        value: nodeVersion,
        status: nodeMajor >= 18 ? 'ok' : 'error',
    });
    // Platform
    diagnostics.push({
        label: 'Platform',
        value: `${os.platform()} ${os.release()}`,
        status: 'ok',
    });
    // Architecture
    diagnostics.push({
        label: 'Architecture',
        value: os.arch(),
        status: 'ok',
    });
    // Memory usage
    const heapUsed = process.memoryUsage().heapUsed;
    const heapMB = heapUsed / (1024 * 1024);
    diagnostics.push({
        label: 'Memory (heap)',
        value: formatBytes(heapUsed),
        status: heapMB > 500 ? 'warning' : 'ok',
    });
    // Current working directory
    diagnostics.push({
        label: 'CWD',
        value: process.cwd(),
        status: 'ok',
    });
    // Git availability
    const gitVersion = getGitVersion();
    diagnostics.push({
        label: 'Git',
        value: gitVersion ?? 'not found',
        status: gitVersion ? 'ok' : 'error',
    });
    // Process uptime
    diagnostics.push({
        label: 'Uptime',
        value: formatUptime(process.uptime()),
        status: 'ok',
    });
    return diagnostics;
}
export const StatusTab = ({ diagnostics }) => {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "System Status" }) }), diagnostics.map((item, index) => {
                const icon = STATUS_ICONS[item.status];
                const color = STATUS_COLORS[item.status];
                return (_jsxs(Box, { children: [_jsx(Text, { color: color, children: icon }), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, children: item.label }), _jsx(Text, { dimColor: true, children: ": " }), _jsx(Text, { children: item.value })] }, index));
            }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Esc to close" }) })] }));
};
/**
 * Recursively render a config value with appropriate coloring and indentation.
 */
function renderConfigValue(value, indent = 0) {
    const prefix = '  '.repeat(indent);
    const lines = [];
    if (value === null || value === undefined) {
        lines.push(_jsxs(Text, { children: [prefix, _jsx(Text, { dimColor: true, children: String(value) })] }, `null-${indent}-${lines.length}`));
        return lines;
    }
    if (typeof value === 'string') {
        lines.push(_jsxs(Text, { children: [prefix, _jsxs(Text, { color: "green", children: ["\"", value, "\""] })] }, `str-${indent}-${lines.length}`));
        return lines;
    }
    if (typeof value === 'number') {
        lines.push(_jsxs(Text, { children: [prefix, _jsx(Text, { color: "yellow", children: String(value) })] }, `num-${indent}-${lines.length}`));
        return lines;
    }
    if (typeof value === 'boolean') {
        lines.push(_jsxs(Text, { children: [prefix, _jsx(Text, { color: "cyan", children: String(value) })] }, `bool-${indent}-${lines.length}`));
        return lines;
    }
    if (Array.isArray(value)) {
        value.forEach((item, i) => {
            const children = renderConfigValue(item, indent + 1);
            lines.push(_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { children: [prefix, _jsxs(Text, { dimColor: true, children: ["[", i, "]"] })] }), children] }, `arr-${indent}-${i}`));
        });
        return lines;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        entries.forEach(([key, val]) => {
            const isNested = val !== null && typeof val === 'object' && !Array.isArray(val);
            const isArray = Array.isArray(val);
            if (isNested || isArray) {
                const children = renderConfigValue(val, indent + 1);
                lines.push(_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { children: [prefix, _jsx(Text, { bold: true, children: key }), _jsx(Text, { dimColor: true, children: ":" })] }), children] }, `obj-${indent}-${key}`));
            }
            else {
                const rendered = renderConfigValue(val, 0);
                lines.push(_jsxs(Box, { children: [_jsxs(Text, { children: [prefix, _jsx(Text, { bold: true, children: key }), _jsx(Text, { dimColor: true, children: ": " })] }), rendered] }, `kv-${indent}-${key}`));
            }
        });
        return lines;
    }
    // Fallback for other types
    lines.push(_jsxs(Text, { children: [prefix, _jsx(Text, { children: String(value) })] }, `fallback-${indent}-${lines.length}`));
    return lines;
}
export const ConfigTab = ({ config }) => {
    const entries = Object.entries(config);
    const isEmpty = entries.length === 0;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Configuration" }) }), isEmpty ? (_jsx(Text, { dimColor: true, children: "No configuration values set." })) : (_jsx(Box, { flexDirection: "column", children: entries.map(([key, value]) => {
                    const isNested = value !== null &&
                        typeof value === 'object' &&
                        !Array.isArray(value);
                    const isArray = Array.isArray(value);
                    if (isNested || isArray) {
                        const children = renderConfigValue(value, 1);
                        return (_jsxs(Box, { flexDirection: "column", marginBottom: 0, children: [_jsxs(Text, { children: [_jsx(Text, { bold: true, children: key }), _jsx(Text, { dimColor: true, children: ":" })] }), children] }, key));
                    }
                    const rendered = renderConfigValue(value, 0);
                    return (_jsxs(Box, { children: [_jsxs(Text, { children: [_jsx(Text, { bold: true, children: key }), _jsx(Text, { dimColor: true, children: ": " })] }), rendered] }, key));
                }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Esc to close" }) })] }));
};
export const UsageTab = ({ usage, model }) => {
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const totalCost = usage?.totalCost ?? 0;
    const sessionDuration = formatUptime(process.uptime());
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "Usage" }) }), _jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Input tokens:  " }), _jsx(Text, { color: "yellow", children: formatNumber(inputTokens) })] }), _jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Output tokens: " }), _jsx(Text, { color: "yellow", children: formatNumber(outputTokens) })] }), _jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Total tokens:  " }), _jsx(Text, { color: "green", children: formatNumber(totalTokens) })] })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Cost estimate: " }), _jsxs(Text, { color: "cyan", children: ["$", totalCost.toFixed(4)] })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, children: "Model: " }), _jsx(Text, { children: model ?? 'unknown' })] }), _jsxs(Box, { children: [_jsx(Text, { bold: true, children: "Session duration: " }), _jsx(Text, { children: sessionDuration })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Esc to close" }) })] }));
};
// ============================================================================
// Settings (main component)
// ============================================================================
export const Settings = ({ onClose, config, usage, model, provider, }) => {
    const [activeTab, setActiveTab] = useState('status');
    const [diagnostics] = useState(() => buildDiagnostics());
    const navigateTab = useCallback((direction) => {
        setActiveTab((current) => {
            const currentIndex = TABS.indexOf(current);
            const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
            return TABS[nextIndex];
        });
    }, []);
    useInput(useCallback((input, key) => {
        // Escape closes the dialog
        if (key.escape) {
            onClose();
            return;
        }
        // Tab or right arrow — next tab
        if (key.tab && !key.shift) {
            navigateTab(1);
            return;
        }
        // Shift+Tab or left arrow — previous tab
        if (key.tab && key.shift) {
            navigateTab(-1);
            return;
        }
        if (key.rightArrow) {
            navigateTab(1);
            return;
        }
        if (key.leftArrow) {
            navigateTab(-1);
            return;
        }
        // Number keys for direct tab selection
        if (input === '1')
            setActiveTab('status');
        if (input === '2')
            setActiveTab('config');
        if (input === '3')
            setActiveTab('usage');
    }, [onClose, navigateTab]));
    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'status':
                return _jsx(StatusTab, { diagnostics: diagnostics });
            case 'config':
                return _jsx(ConfigTab, { config: config, onClose: onClose });
            case 'usage':
                return _jsx(UsageTab, { usage: usage, model: model });
            default:
                return null;
        }
    };
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "blue", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "blue", children: "\u2699 Settings" }), provider && (_jsxs(Text, { dimColor: true, children: [" \u2014 ", provider] }))] }), _jsx(Box, { marginBottom: 1, gap: 1, children: TABS.map((tab) => {
                    const isActive = tab === activeTab;
                    return (_jsx(Text, { bold: isActive, color: isActive ? 'blue' : undefined, inverse: isActive, children: ` ${TAB_LABELS[tab]} ` }, tab));
                }) }), _jsx(Box, { flexDirection: "column", paddingX: 1, children: renderTabContent() }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Tab/\u2190/\u2192 switch tabs \u00B7 Esc close" }) })] }));
};
//# sourceMappingURL=Settings.js.map