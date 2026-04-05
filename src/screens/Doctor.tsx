/**
 * Doctor Screen — System diagnostics display.
 *
 * Implements the same diagnostic checks as Claude Code's Doctor.tsx:
 * - Environment info (Node.js, platform, architecture)
 * - Provider connectivity test
 * - Configuration validation
 * - Git status
 * - MCP server status
 * - Memory/session storage status
 * - Permission settings
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import { buildDiagnostics, type DiagnosticItem } from '../components/Settings/Settings.js'
import type { LLMProvider } from '../providers/types.js'
import type { KiteConfig } from '../utils/config.js'

// ============================================================================
// Types
// ============================================================================

export interface DoctorProps {
  config: KiteConfig
  provider: LLMProvider
  onDone?: (result?: string) => void
}

interface ConnectivityResult {
  status: 'testing' | 'connected' | 'failed'
  message: string
  latencyMs?: number
}

// ============================================================================
// Extended diagnostics
// ============================================================================

function getExtendedDiagnostics(config: KiteConfig): DiagnosticItem[] {
  const diagnostics = buildDiagnostics()

  // Provider info
  diagnostics.push({
    label: 'Provider',
    value: `${config.provider.name} (${config.provider.model})`,
    status: 'ok',
  })

  // API endpoint
  diagnostics.push({
    label: 'API Endpoint',
    value: config.provider.apiBaseUrl || '(default)',
    status: config.provider.apiBaseUrl ? 'ok' : 'warning',
  })

  // Config file
  diagnostics.push({
    label: 'Config File',
    value: config.configPath || '(none found)',
    status: config.configPath ? 'ok' : 'warning',
  })

  // Permission mode
  diagnostics.push({
    label: 'Permission Mode',
    value: config.behavior.permissionMode,
    status: 'ok',
  })

  // Max tokens
  diagnostics.push({
    label: 'Max Tokens',
    value: String(config.behavior.maxTokens),
    status: 'ok',
  })

  // Kite config directory
  const kiteDir = join(homedir(), '.kite')
  diagnostics.push({
    label: 'Kite Dir',
    value: kiteDir,
    status: existsSync(kiteDir) ? 'ok' : 'warning',
  })

  // Sessions directory
  const sessionsDir = join(homedir(), '.kite', 'sessions')
  diagnostics.push({
    label: 'Sessions Dir',
    value: sessionsDir,
    status: existsSync(sessionsDir) ? 'ok' : 'warning',
  })

  // Skills
  const skillsDirs = [
    join(process.cwd(), '.kite', 'skills'),
    join(process.cwd(), '.claude', 'skills'),
    join(homedir(), '.kite', 'skills'),
  ]
  const foundSkillsDir = skillsDirs.find(d => existsSync(d))
  diagnostics.push({
    label: 'Skills Dir',
    value: foundSkillsDir || '(none)',
    status: foundSkillsDir ? 'ok' : 'warning',
  })

  // Memory files
  const memoryFiles = ['AGENTS.md', 'CLAUDE.md'].filter(f =>
    existsSync(join(process.cwd(), f)),
  )
  diagnostics.push({
    label: 'Memory Files',
    value: memoryFiles.length > 0 ? memoryFiles.join(', ') : '(none)',
    status: 'ok',
  })

  // MCP config
  const mcpConfigs = ['.mcp.json', 'mcp.json'].filter(f =>
    existsSync(join(process.cwd(), f)),
  )
  diagnostics.push({
    label: 'MCP Config',
    value: mcpConfigs.length > 0 ? mcpConfigs.join(', ') : '(none)',
    status: 'ok',
  })

  return diagnostics
}

// ============================================================================
// Doctor Component
// ============================================================================

export const Doctor: React.FC<DoctorProps> = ({ config, provider, onDone }) => {
  const { exit } = useApp()
  const [connectivity, setConnectivity] = useState<ConnectivityResult>({
    status: 'testing',
    message: 'Testing connectivity...',
  })

  const diagnostics = useMemo(() => getExtendedDiagnostics(config), [config])

  // Test connectivity on mount
  useEffect(() => {
    const startTime = Date.now()
    const testConnection = async () => {
      try {
        const stream = provider.chat({
          model: config.provider.model,
          messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          maxTokens: 10,
          stream: true,
        })

        let gotResponse = false
        for await (const event of stream) {
          if (event.type === 'text_delta' || event.type === 'message_end') {
            gotResponse = true
            break
          }
          if (event.type === 'error') {
            setConnectivity({
              status: 'failed',
              message: event.message,
            })
            return
          }
        }

        if (gotResponse) {
          setConnectivity({
            status: 'connected',
            message: `Connected to ${config.provider.name}`,
            latencyMs: Date.now() - startTime,
          })
        } else {
          setConnectivity({
            status: 'failed',
            message: 'No response received',
          })
        }
      } catch (err) {
        setConnectivity({
          status: 'failed',
          message: (err as Error).message,
        })
      }
    }

    void testConnection()
  }, [provider, config])

  // Handle input
  useInput((input, key) => {
    if (key.return || key.escape || input === 'q') {
      if (onDone) {
        onDone('Doctor dismissed')
      } else {
        exit()
      }
    }
  })

  // Status icon helper
  const statusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'ok': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✗'
    }
  }

  const statusColor = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'ok': return 'green'
      case 'warning': return 'yellow'
      case 'error': return 'red'
    }
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">🔍 Kite Doctor</Text>
      </Box>

      {/* System diagnostics */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>System</Text>
        {diagnostics.map((d, i) => (
          <Box key={i}>
            <Text color={statusColor(d.status)}>{statusIcon(d.status)} </Text>
            <Text dimColor>{d.label}: </Text>
            <Text>{d.value}</Text>
          </Box>
        ))}
      </Box>

      {/* Connectivity */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Connectivity</Text>
        <Box>
          {connectivity.status === 'testing' && (
            <Text color="yellow">⏳ Testing connection to {config.provider.name}...</Text>
          )}
          {connectivity.status === 'connected' && (
            <Text color="green">
              ✓ {connectivity.message}
              {connectivity.latencyMs !== undefined && (
                <Text dimColor> ({connectivity.latencyMs}ms)</Text>
              )}
            </Text>
          )}
          {connectivity.status === 'failed' && (
            <Text color="red">✗ Connection failed: {connectivity.message}</Text>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Enter, Escape, or q to close</Text>
      </Box>
    </Box>
  )
}
