/**
 * Tabs — Horizontal tab bar with keyboard navigation.
 *
 * Shows tabs in a horizontal row. The active tab is highlighted with inverse
 * styling. Use left/right arrow keys to navigate and the onSelect callback
 * fires when the active tab changes.
 *
 * @example
 * const [tab, setTab] = useState('general')
 * <Tabs
 *   tabs={[
 *     { label: 'General', value: 'general' },
 *     { label: 'Advanced', value: 'advanced' },
 *   ]}
 *   activeTab={tab}
 *   onSelect={setTab}
 * />
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ThemeTokens } from '../../themes/themes.js'
import { useTheme } from '../../themes/ThemeProvider.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabDef = {
  label: string
  value: string
}

export type TabsProps = {
  /** Tab definitions. */
  tabs: TabDef[]
  /** Currently active tab value. */
  activeTab: string
  /** Called when the user navigates to a new tab. */
  onSelect: (value: string) => void
  /** Whether the tab bar accepts keyboard input. @default true */
  isActive?: boolean
  /** Colour for the active tab — theme token or raw colour. */
  color?: string
}

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

function resolveColor(
  color: string | undefined,
  colors: ThemeTokens,
): string | undefined {
  if (!color) return undefined
  if (color in colors) {
    return colors[color]
  }
  return color
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Tabs({
  tabs,
  activeTab,
  onSelect,
  isActive = true,
  color,
}: TabsProps): React.ReactElement {
  const [, colors] = useTheme()
  const resolvedColor = resolveColor(color, colors)

  // Track which index is active
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.value === activeTab),
  )
  const [focusedIndex, setFocusedIndex] = useState(activeIndex)

  // Keep focused index in sync with external activeTab changes
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.value === activeTab)
    if (idx >= 0) {
      setFocusedIndex(idx)
    }
  }, [activeTab, tabs])

  useInput(
    (_input, key) => {
      if (!isActive || tabs.length === 0) return

      if (key.leftArrow) {
        const newIndex = focusedIndex <= 0 ? tabs.length - 1 : focusedIndex - 1
        setFocusedIndex(newIndex)
        const tab = tabs[newIndex]
        if (tab) onSelect(tab.value)
        return
      }
      if (key.rightArrow) {
        const newIndex = focusedIndex >= tabs.length - 1 ? 0 : focusedIndex + 1
        setFocusedIndex(newIndex)
        const tab = tabs[newIndex]
        if (tab) onSelect(tab.value)
        return
      }
      if (key.return) {
        const tab = tabs[focusedIndex]
        if (tab) onSelect(tab.value)
        return
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="row" gap={1}>
      {tabs.map((tab, i) => {
        const isCurrent = i === focusedIndex
        const tabColor = resolvedColor ?? colors.primary

        return (
          <Text
            key={tab.value}
            inverse={isCurrent}
            bold={isCurrent}
            color={isCurrent ? tabColor : undefined}
            dimColor={!isCurrent}
          >
            {' '}
            {tab.label}
            {' '}
          </Text>
        )
      })}
    </Box>
  )
}

export default Tabs
