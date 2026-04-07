/**
 * StatsDashboard — Visual session statistics with ASCII charts.
 *
 * Renders a rich dashboard for the /stats command with:
 * - Token usage bar chart (input vs output)
 * - Context window gauge
 * - Session metrics table
 * - Cost breakdown
 */

import React from 'react'
import { Box, Text } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface StatsData {
  duration: string
  messageCount: number
  userMessages: number
  assistantMessages: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreateTokens: number
  totalTokens: number
  contextWindow: number
  model: string
  provider: string
  heapUsedMB: number
  heapTotalMB: number
}

// ============================================================================
// ASCII Chart Helpers
// ============================================================================

function barChart(
  value: number,
  maxValue: number,
  width: number = 30,
  fillChar: string = '█',
  emptyChar: string = '░',
): string {
  const filled = Math.round((value / Math.max(maxValue, 1)) * width)
  const empty = width - filled
  return fillChar.repeat(Math.max(0, filled)) + emptyChar.repeat(Math.max(0, empty))
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function percentOf(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

// ============================================================================
// Component
// ============================================================================

export const StatsDashboard: React.FC<{ data: StatsData }> = ({ data }) => {
  const contextPct = data.totalTokens > 0
    ? Math.round((data.totalTokens / data.contextWindow) * 100)
    : 0
  const contextColor = contextPct > 80 ? 'red' : contextPct > 50 ? 'yellow' : 'green'

  const inputPct = data.totalTokens > 0 ? (data.inputTokens / data.totalTokens) : 0
  const outputPct = data.totalTokens > 0 ? (data.outputTokens / data.totalTokens) : 0

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">{'━'.repeat(50)}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">  Session Statistics</Text>
      </Box>

      {/* Session Info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Box width={18}><Text dimColor>  Duration:</Text></Box>
          <Text bold>{data.duration}</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Model:</Text></Box>
          <Text>{data.model}</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Provider:</Text></Box>
          <Text>{data.provider}</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Messages:</Text></Box>
          <Text>{data.messageCount} </Text>
          <Text dimColor>({data.userMessages} user, {data.assistantMessages} assistant)</Text>
        </Box>
      </Box>

      {/* Context Window Gauge */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold dimColor>  Context Window</Text>
        <Box>
          <Text>  </Text>
          <Text color={contextColor}>{barChart(data.totalTokens, data.contextWindow, 35)}</Text>
          <Text> </Text>
          <Text color={contextColor} bold>{contextPct}%</Text>
        </Box>
        <Box>
          <Text dimColor>  {formatTokens(data.totalTokens)} / {formatTokens(data.contextWindow)} tokens</Text>
        </Box>
      </Box>

      {/* Token Breakdown */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold dimColor>  Token Breakdown</Text>
        <Box>
          <Box width={18}><Text dimColor>  Input:</Text></Box>
          <Text color="cyan">{barChart(data.inputTokens, data.totalTokens, 20)}</Text>
          <Text> {formatTokens(data.inputTokens)} </Text>
          <Text dimColor>({percentOf(data.inputTokens, data.totalTokens)})</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Output:</Text></Box>
          <Text color="green">{barChart(data.outputTokens, data.totalTokens, 20)}</Text>
          <Text> {formatTokens(data.outputTokens)} </Text>
          <Text dimColor>({percentOf(data.outputTokens, data.totalTokens)})</Text>
        </Box>
        {data.cacheReadTokens > 0 && (
          <Box>
            <Box width={18}><Text dimColor>  Cache read:</Text></Box>
            <Text color="magenta">{barChart(data.cacheReadTokens, data.totalTokens, 20)}</Text>
            <Text> {formatTokens(data.cacheReadTokens)} </Text>
            <Text dimColor>({percentOf(data.cacheReadTokens, data.totalTokens)})</Text>
          </Box>
        )}
        {data.cacheCreateTokens > 0 && (
          <Box>
            <Box width={18}><Text dimColor>  Cache create:</Text></Box>
            <Text color="yellow">{barChart(data.cacheCreateTokens, data.totalTokens, 20)}</Text>
            <Text> {formatTokens(data.cacheCreateTokens)} </Text>
            <Text dimColor>({percentOf(data.cacheCreateTokens, data.totalTokens)})</Text>
          </Box>
        )}
        <Box>
          <Box width={18}><Text dimColor>  ──────────</Text></Box>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Total:</Text></Box>
          <Text bold>{formatTokens(data.totalTokens)}</Text>
        </Box>
      </Box>

      {/* Memory */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold dimColor>  Memory</Text>
        <Box>
          <Box width={18}><Text dimColor>  Heap:</Text></Box>
          <Text>{data.heapUsedMB}MB / {data.heapTotalMB}MB</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  PID:</Text></Box>
          <Text>{process.pid}</Text>
        </Box>
        <Box>
          <Box width={18}><Text dimColor>  Node.js:</Text></Box>
          <Text>{process.version}</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box>
        <Text bold color="cyan">{'━'.repeat(50)}</Text>
      </Box>
    </Box>
  )
}

/**
 * Build StatsData from app state for the /stats command.
 */
export function buildStatsData(
  appState: Record<string, unknown>,
  model: string,
  provider: string,
  messageCount: number,
  userMessages: number,
  assistantMessages: number,
): StatsData {
  const uptime = Math.floor(process.uptime())
  const minutes = Math.floor(uptime / 60)
  const seconds = uptime % 60
  const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  const usage = (appState._cumulativeUsage ?? {}) as Record<string, number>
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const cacheReadTokens = usage.cacheReadInputTokens ?? 0
  const cacheCreateTokens = usage.cacheCreationInputTokens ?? 0
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreateTokens

  // Context window detection
  const contextWindows: Record<string, number> = {
    'claude-sonnet-4-20250514': 200000,
    'claude-opus-4-20250514': 200000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'deepseek-chat': 128000,
  }
  let contextWindow = 128000
  for (const [key, val] of Object.entries(contextWindows)) {
    if (model.includes(key.split('-').slice(0, 2).join('-'))) {
      contextWindow = val
      break
    }
  }

  const mem = process.memoryUsage()

  return {
    duration,
    messageCount,
    userMessages,
    assistantMessages,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreateTokens,
    totalTokens,
    contextWindow,
    model,
    provider,
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
  }
}
