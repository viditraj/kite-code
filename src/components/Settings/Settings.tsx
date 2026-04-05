/**
 * Settings — tabbed settings dialog with system status, configuration,
 * and usage statistics.
 *
 * Provides diagnostics, config introspection, and token/cost tracking
 * in a navigable multi-tab layout.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import * as os from 'node:os'
import { execSync } from 'node:child_process'

// ============================================================================
// Types
// ============================================================================

export type SettingsTab = 'status' | 'config' | 'usage'

export interface SettingsProps {
  onClose: (result?: string) => void
  config: Record<string, unknown>
  usage?: { inputTokens: number; outputTokens: number; totalCost: number }
  model?: string
  provider?: string
}

export interface DiagnosticItem {
  label: string
  value: string
  status: 'ok' | 'warning' | 'error'
}

// ============================================================================
// Constants
// ============================================================================

const TABS: SettingsTab[] = ['status', 'config', 'usage']

const TAB_LABELS: Record<SettingsTab, string> = {
  status: 'Status',
  config: 'Config',
  usage: 'Usage',
}

const STATUS_ICONS: Record<DiagnosticItem['status'], string> = {
  ok: '✓',
  warning: '⚠',
  error: '✗',
}

const STATUS_COLORS: Record<DiagnosticItem['status'], string> = {
  ok: 'green',
  warning: 'yellow',
  error: 'red',
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format bytes into a human-readable string (e.g. "45.2 MB").
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Format seconds into a human-readable duration string.
 */
function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (hrs > 0) parts.push(`${hrs}h`)
  if (mins > 0) parts.push(`${mins}m`)
  parts.push(`${secs}s`)

  return parts.join(' ')
}

/**
 * Format a number with commas for readability.
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Parse major version from a Node version string like "v20.11.0".
 */
function parseNodeMajor(version: string): number {
  const match = version.match(/^v?(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Attempt to get the git version string. Returns null on failure.
 */
function getGitVersion(): string | null {
  try {
    const output = execSync('git --version', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.trim()
  } catch {
    return null
  }
}

// ============================================================================
// buildDiagnostics
// ============================================================================

/**
 * Build an array of system diagnostic items for the status tab.
 */
export function buildDiagnostics(): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = []

  // Node.js version
  const nodeVersion = process.version
  const nodeMajor = parseNodeMajor(nodeVersion)
  diagnostics.push({
    label: 'Node.js',
    value: nodeVersion,
    status: nodeMajor >= 18 ? 'ok' : 'error',
  })

  // Platform
  diagnostics.push({
    label: 'Platform',
    value: `${os.platform()} ${os.release()}`,
    status: 'ok',
  })

  // Architecture
  diagnostics.push({
    label: 'Architecture',
    value: os.arch(),
    status: 'ok',
  })

  // Memory usage
  const heapUsed = process.memoryUsage().heapUsed
  const heapMB = heapUsed / (1024 * 1024)
  diagnostics.push({
    label: 'Memory (heap)',
    value: formatBytes(heapUsed),
    status: heapMB > 500 ? 'warning' : 'ok',
  })

  // Current working directory
  diagnostics.push({
    label: 'CWD',
    value: process.cwd(),
    status: 'ok',
  })

  // Git availability
  const gitVersion = getGitVersion()
  diagnostics.push({
    label: 'Git',
    value: gitVersion ?? 'not found',
    status: gitVersion ? 'ok' : 'error',
  })

  // Process uptime
  diagnostics.push({
    label: 'Uptime',
    value: formatUptime(process.uptime()),
    status: 'ok',
  })

  return diagnostics
}

// ============================================================================
// StatusTab
// ============================================================================

export interface StatusTabProps {
  diagnostics: DiagnosticItem[]
}

export const StatusTab: React.FC<StatusTabProps> = ({ diagnostics }) => {
  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          System Status
        </Text>
      </Box>

      {/* Diagnostic items */}
      {diagnostics.map((item, index) => {
        const icon = STATUS_ICONS[item.status]
        const color = STATUS_COLORS[item.status]

        return (
          <Box key={index}>
            <Text color={color}>{icon}</Text>
            <Text> </Text>
            <Text bold>{item.label}</Text>
            <Text dimColor>: </Text>
            <Text>{item.value}</Text>
          </Box>
        )
      })}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// ConfigTab
// ============================================================================

export interface ConfigTabProps {
  config: Record<string, unknown>
  onClose: (result?: string) => void
}

/**
 * Recursively render a config value with appropriate coloring and indentation.
 */
function renderConfigValue(
  value: unknown,
  indent: number = 0
): React.ReactNode[] {
  const prefix = '  '.repeat(indent)
  const lines: React.ReactNode[] = []

  if (value === null || value === undefined) {
    lines.push(
      <Text key={`null-${indent}-${lines.length}`}>
        {prefix}
        <Text dimColor>{String(value)}</Text>
      </Text>
    )
    return lines
  }

  if (typeof value === 'string') {
    lines.push(
      <Text key={`str-${indent}-${lines.length}`}>
        {prefix}
        <Text color="green">&quot;{value}&quot;</Text>
      </Text>
    )
    return lines
  }

  if (typeof value === 'number') {
    lines.push(
      <Text key={`num-${indent}-${lines.length}`}>
        {prefix}
        <Text color="yellow">{String(value)}</Text>
      </Text>
    )
    return lines
  }

  if (typeof value === 'boolean') {
    lines.push(
      <Text key={`bool-${indent}-${lines.length}`}>
        {prefix}
        <Text color="cyan">{String(value)}</Text>
      </Text>
    )
    return lines
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const children = renderConfigValue(item, indent + 1)
      lines.push(
        <Box key={`arr-${indent}-${i}`} flexDirection="column">
          <Text>
            {prefix}
            <Text dimColor>[{i}]</Text>
          </Text>
          {children}
        </Box>
      )
    })
    return lines
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    entries.forEach(([key, val]) => {
      const isNested =
        val !== null && typeof val === 'object' && !Array.isArray(val)
      const isArray = Array.isArray(val)

      if (isNested || isArray) {
        const children = renderConfigValue(val, indent + 1)
        lines.push(
          <Box key={`obj-${indent}-${key}`} flexDirection="column">
            <Text>
              {prefix}
              <Text bold>{key}</Text>
              <Text dimColor>:</Text>
            </Text>
            {children}
          </Box>
        )
      } else {
        const rendered = renderConfigValue(val, 0)
        lines.push(
          <Box key={`kv-${indent}-${key}`}>
            <Text>
              {prefix}
              <Text bold>{key}</Text>
              <Text dimColor>: </Text>
            </Text>
            {rendered}
          </Box>
        )
      }
    })
    return lines
  }

  // Fallback for other types
  lines.push(
    <Text key={`fallback-${indent}-${lines.length}`}>
      {prefix}
      <Text>{String(value)}</Text>
    </Text>
  )
  return lines
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ config }) => {
  const entries = Object.entries(config)
  const isEmpty = entries.length === 0

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Configuration
        </Text>
      </Box>

      {/* Config entries */}
      {isEmpty ? (
        <Text dimColor>No configuration values set.</Text>
      ) : (
        <Box flexDirection="column">
          {entries.map(([key, value]) => {
            const isNested =
              value !== null &&
              typeof value === 'object' &&
              !Array.isArray(value)
            const isArray = Array.isArray(value)

            if (isNested || isArray) {
              const children = renderConfigValue(value, 1)
              return (
                <Box key={key} flexDirection="column" marginBottom={0}>
                  <Text>
                    <Text bold>{key}</Text>
                    <Text dimColor>:</Text>
                  </Text>
                  {children}
                </Box>
              )
            }

            const rendered = renderConfigValue(value, 0)
            return (
              <Box key={key}>
                <Text>
                  <Text bold>{key}</Text>
                  <Text dimColor>: </Text>
                </Text>
                {rendered}
              </Box>
            )
          })}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// UsageTab
// ============================================================================

export interface UsageTabProps {
  usage?: { inputTokens: number; outputTokens: number; totalCost: number }
  model?: string
}

export const UsageTab: React.FC<UsageTabProps> = ({ usage, model }) => {
  const inputTokens = usage?.inputTokens ?? 0
  const outputTokens = usage?.outputTokens ?? 0
  const totalTokens = inputTokens + outputTokens
  const totalCost = usage?.totalCost ?? 0

  const sessionDuration = formatUptime(process.uptime())

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Usage
        </Text>
      </Box>

      {/* Token counts */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold>Input tokens:  </Text>
          <Text color="yellow">{formatNumber(inputTokens)}</Text>
        </Box>
        <Box>
          <Text bold>Output tokens: </Text>
          <Text color="yellow">{formatNumber(outputTokens)}</Text>
        </Box>
        <Box>
          <Text bold>Total tokens:  </Text>
          <Text color="green">{formatNumber(totalTokens)}</Text>
        </Box>
      </Box>

      {/* Cost estimate */}
      <Box marginBottom={1}>
        <Text bold>Cost estimate: </Text>
        <Text color="cyan">${totalCost.toFixed(4)}</Text>
      </Box>

      {/* Model info */}
      <Box marginBottom={1}>
        <Text bold>Model: </Text>
        <Text>{model ?? 'unknown'}</Text>
      </Box>

      {/* Session duration */}
      <Box>
        <Text bold>Session duration: </Text>
        <Text>{sessionDuration}</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// Settings (main component)
// ============================================================================

export const Settings: React.FC<SettingsProps> = ({
  onClose,
  config,
  usage,
  model,
  provider,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('status')
  const [diagnostics] = useState<DiagnosticItem[]>(() => buildDiagnostics())

  const navigateTab = useCallback(
    (direction: 1 | -1) => {
      setActiveTab((current) => {
        const currentIndex = TABS.indexOf(current)
        const nextIndex =
          (currentIndex + direction + TABS.length) % TABS.length
        return TABS[nextIndex]
      })
    },
    []
  )

  useInput(
    useCallback(
      (input: string, key) => {
        // Escape closes the dialog
        if (key.escape) {
          onClose()
          return
        }

        // Tab or right arrow — next tab
        if (key.tab && !key.shift) {
          navigateTab(1)
          return
        }

        // Shift+Tab or left arrow — previous tab
        if (key.tab && key.shift) {
          navigateTab(-1)
          return
        }

        if (key.rightArrow) {
          navigateTab(1)
          return
        }

        if (key.leftArrow) {
          navigateTab(-1)
          return
        }

        // Number keys for direct tab selection
        if (input === '1') setActiveTab('status')
        if (input === '2') setActiveTab('config')
        if (input === '3') setActiveTab('usage')
      },
      [onClose, navigateTab]
    )
  )

  // Render tab content based on active tab
  const renderTabContent = (): React.ReactNode => {
    switch (activeTab) {
      case 'status':
        return <StatusTab diagnostics={diagnostics} />
      case 'config':
        return <ConfigTab config={config} onClose={onClose} />
      case 'usage':
        return <UsageTab usage={usage} model={model} />
      default:
        return null
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      paddingY={0}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          ⚙ Settings
        </Text>
        {provider && (
          <Text dimColor> — {provider}</Text>
        )}
      </Box>

      {/* Tab bar */}
      <Box marginBottom={1} gap={1}>
        {TABS.map((tab) => {
          const isActive = tab === activeTab
          return (
            <Text
              key={tab}
              bold={isActive}
              color={isActive ? 'blue' : undefined}
              inverse={isActive}
            >
              {` ${TAB_LABELS[tab]} `}
            </Text>
          )
        })}
      </Box>

      {/* Tab content */}
      <Box flexDirection="column" paddingX={1}>
        {renderTabContent()}
      </Box>

      {/* Navigation help */}
      <Box marginTop={1}>
        <Text dimColor>
          Tab/←/→ switch tabs · Esc close
        </Text>
      </Box>
    </Box>
  )
}
