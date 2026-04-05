/**
 * ThemePicker — Theme preview with live switching.
 *
 * Shows each theme with color preview samples (colored dots/blocks)
 * so the user can see what the theme looks like before selecting.
 * Arrow keys to navigate, Enter to select, Esc to cancel.
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemePickerProps {
  /** Available theme names. */
  themes: string[]
  /** Currently active theme. */
  currentTheme: string
  /** Called when the user selects a theme. */
  onSelect: (theme: string) => void
  /** Called when the user cancels (Esc). */
  onCancel: () => void
  /** Whether this component receives keyboard input. */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Theme colour palettes — shows what each theme looks like
// ---------------------------------------------------------------------------

interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  muted: string
}

const THEME_PALETTES: Record<string, ThemeColors> = {
  default: { primary: 'cyan', secondary: 'green', accent: 'yellow', muted: 'gray' },
  dark: { primary: 'blue', secondary: 'magenta', accent: 'red', muted: 'gray' },
  light: { primary: 'cyan', secondary: 'green', accent: 'yellow', muted: 'white' },
  monokai: { primary: 'magenta', secondary: 'green', accent: 'yellow', muted: 'gray' },
  dracula: { primary: 'magenta', secondary: 'cyan', accent: 'green', muted: 'gray' },
  solarized: { primary: 'blue', secondary: 'cyan', accent: 'yellow', muted: 'green' },
  nord: { primary: 'blue', secondary: 'cyan', accent: 'white', muted: 'gray' },
  gruvbox: { primary: 'yellow', secondary: 'green', accent: 'red', muted: 'gray' },
}

function getPalette(theme: string): ThemeColors {
  return (
    THEME_PALETTES[theme.toLowerCase()] ?? {
      primary: 'cyan',
      secondary: 'green',
      accent: 'yellow',
      muted: 'gray',
    }
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThemePicker({
  themes,
  currentTheme,
  onSelect,
  onCancel,
  isActive = true,
}: ThemePickerProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = themes.indexOf(currentTheme)
    return idx >= 0 ? idx : 0
  })

  useInput(
    (input, key) => {
      if (!isActive) return

      if (key.escape) {
        onCancel()
        return
      }
      if (key.upArrow) {
        setSelectedIdx((prev) => (prev - 1 + themes.length) % themes.length)
        return
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => (prev + 1) % themes.length)
        return
      }
      if (key.return) {
        const theme = themes[selectedIdx]
        if (theme) onSelect(theme)
        return
      }

      // Number keys for quick select (1-9)
      const num = parseInt(input, 10)
      if (num >= 1 && num <= themes.length) {
        const theme = themes[num - 1]
        if (theme) onSelect(theme)
        return
      }
    },
    { isActive },
  )

  // Currently previewed theme
  const previewTheme = themes[selectedIdx] ?? currentTheme
  const palette = getPalette(previewTheme)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Select Theme
        </Text>
        <Text dimColor>
          {'  (\u2191\u2193 navigate, Enter select, Esc cancel)'}
        </Text>
      </Box>

      {/* Theme list */}
      {themes.map((theme, idx) => {
        const isSelected = idx === selectedIdx
        const isCurrent = theme === currentTheme
        const pal = getPalette(theme)
        return (
          <Box key={theme}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '\u276F ' : '  '}
            </Text>
            <Text dimColor>{`${idx + 1}. `}</Text>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {theme}
            </Text>
            {isCurrent && <Text color="green">{' (current)'}</Text>}
            {/* Color preview dots */}
            <Text>{'  '}</Text>
            <Text color={pal.primary}>{'\u2588'}</Text>
            <Text color={pal.secondary}>{'\u2588'}</Text>
            <Text color={pal.accent}>{'\u2588'}</Text>
            <Text color={pal.muted}>{'\u2588'}</Text>
          </Box>
        )
      })}

      {/* Live preview section */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Preview: </Text>
        <Box>
          <Text color={palette.primary}>{'\u2588\u2588\u2588'}</Text>
          <Text> </Text>
          <Text color={palette.secondary}>{'\u2588\u2588\u2588'}</Text>
          <Text> </Text>
          <Text color={palette.accent}>{'\u2588\u2588\u2588'}</Text>
          <Text> </Text>
          <Text color={palette.muted}>{'\u2588\u2588\u2588'}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={palette.primary}>function </Text>
          <Text color={palette.secondary}>greet</Text>
          <Text color={palette.muted}>{'() { '}</Text>
          <Text color={palette.accent}>return </Text>
          <Text color={palette.primary}>&quot;hello&quot;</Text>
          <Text color={palette.muted}>{' }'}</Text>
        </Box>
      </Box>
    </Box>
  )
}
