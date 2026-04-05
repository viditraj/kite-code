/**
 * LogoV2 — Welcome screen matching Claude Code's visual impact.
 *
 * Uses large block-letter text to render "KITE CODE" in massive characters,
 * similar to the first Claude Code welcome screen. Below the banner:
 * model info, CWD, tips — all clean and professional.
 *
 * Falls back gracefully if ink-big-text/cfonts is not available.
 */

import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTerminalSize } from '../../ink/hooks/useTerminalSize.js'

// ============================================================================
// Types
// ============================================================================

export interface LogoProps {
  version?: string
  model?: string
  provider?: string
  cwd?: string
}

// ============================================================================
// Block-letter fallback (used if ink-big-text can't load)
// ============================================================================

const KITE_BLOCK = [
  '\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D',
  '\u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2557  ',
  '\u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u255D  ',
  '\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
]

const CODE_BLOCK = [
  '   \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '   \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D',
  '   \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  ',
  '   \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  ',
  '   \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '    \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
]

// ============================================================================
// Try to load ink-big-text dynamically
// ============================================================================

let BigTextComponent: React.FC<{ text: string; font?: string; colors?: string[]; space?: boolean }> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('ink-big-text')
  BigTextComponent = mod.default ?? mod
} catch {
  // ink-big-text not available — use fallback block letters
}

// ============================================================================
// Tips
// ============================================================================

const TIPS = [
  'Type /help for available commands',
  '/model to switch models mid-session',
  '/provider to switch LLM providers',
  '/compact to save context tokens',
  '/cost shows your session spending',
  'Use -p flag for non-interactive mode',
  'kite --setup to reconfigure providers',
  'kite --doctor to check your setup',
]

function truncatePath(p: string, max: number): string {
  if (p.length <= max) return p
  const parts = p.split('/')
  if (parts.length <= 3) return '\u2026' + p.slice(-(max - 1))
  return parts[0] + '/\u2026/' + parts.slice(-2).join('/')
}

// ============================================================================
// BlockBanner — renders KITE or CODE in block letters
// ============================================================================

const BlockBanner: React.FC<{
  text: string
  fallbackLines: string[]
  color: string
  font?: string
}> = ({ text, fallbackLines, color, font = 'block' }) => {
  if (BigTextComponent) {
    return (
      <Box>
        <BigTextComponent text={text} font={font} colors={[color]} space={false} />
      </Box>
    )
  }

  // Fallback: pre-built block letters
  return (
    <Box flexDirection="column">
      {fallbackLines.map((line, i) => (
        <Text key={i} color={color}>{line}</Text>
      ))}
    </Box>
  )
}

// ============================================================================
// LogoV2 — Main Component
// ============================================================================

export const LogoV2: React.FC<LogoProps> = ({
  version = '0.1.0',
  model,
  provider,
  cwd,
}) => {
  const { columns } = useTerminalSize()
  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)]!, [])
  const displayCwd = cwd ? truncatePath(cwd, 50) : undefined

  if (columns < 40) {
    return <CondensedLogo version={version} model={model} provider={provider} />
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Welcome header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text color="cyan" bold>{'\u2731 '}</Text>
        <Text>Welcome to </Text>
        <Text color="cyan" bold>Kite Code </Text>
        <Text dimColor>v{version}</Text>
      </Box>

      {/* Giant KITE */}
      <BlockBanner text="KITE" fallbackLines={KITE_BLOCK} color="cyan" />

      {/* Giant CODE */}
      <BlockBanner text="CODE" fallbackLines={CODE_BLOCK} color="blue" />

      {/* Info section */}
      <Box flexDirection="column" marginTop={1}>
        {model && (
          <Box>
            <Text dimColor>{'  '}</Text>
            <Text bold>{model}</Text>
            {provider && <Text dimColor> via </Text>}
            {provider && <Text color="cyan">{provider}</Text>}
          </Box>
        )}
        {displayCwd && (
          <Box>
            <Text dimColor>{'  '}{displayCwd}</Text>
          </Box>
        )}
      </Box>

      {/* Tip */}
      <Box marginTop={1}>
        <Text color="cyan">{'  \u25B8 '}</Text>
        <Text dimColor>{tip}</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// CondensedLogo
// ============================================================================

export const CondensedLogo: React.FC<LogoProps> = ({
  version = '0.1.0',
  model,
  provider,
}) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text color="cyan" bold>{'\u25C6 Kite Code'}</Text>
      <Text dimColor> v{version}</Text>
      {model && <Text dimColor> {'\u00B7'} {model}</Text>}
      {provider && <Text dimColor> ({provider})</Text>}
    </Box>
  </Box>
)
