/**
 * CategoryPicker — Horizontal tab bar for marketplace categories.
 *
 * Renders category tabs along the top of the marketplace browser. The active
 * category is highlighted with inverse styling. Left/Right arrow keys switch
 * categories, triggering the onSelect callback.
 *
 * @example
 * <CategoryPicker
 *   activeCategory="database"
 *   onSelect={(cat) => fetchServers(cat)}
 * />
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoryDef = {
  id: string
  label: string
}

export type CategoryPickerProps = {
  /** Currently active category ID (null or 'all' for no filter). */
  activeCategory: string | null
  /** Called when the user switches to a different category. */
  onSelect: (categoryId: string | null) => void
  /** Whether the picker accepts keyboard input. @default true */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Default categories (matches mcpservers.org)
// ---------------------------------------------------------------------------

const CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All' },
  { id: 'search', label: 'Search' },
  { id: 'web-scraping', label: 'Web' },
  { id: 'communication', label: 'Comm' },
  { id: 'productivity', label: 'Prod' },
  { id: 'development', label: 'Dev' },
  { id: 'database', label: 'DB' },
  { id: 'cloud-service', label: 'Cloud' },
  { id: 'file-system', label: 'Files' },
  { id: 'version-control', label: 'VCS' },
  { id: 'other', label: 'Other' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryPicker({
  activeCategory,
  onSelect,
  isActive = true,
}: CategoryPickerProps): React.ReactElement {
  const colors = getActiveColors()

  const activeId = activeCategory ?? 'all'
  const activeIndex = useMemo(
    () => Math.max(0, CATEGORIES.findIndex(c => c.id === activeId)),
    [activeId],
  )
  const [focusedIndex, setFocusedIndex] = useState(activeIndex)

  useEffect(() => {
    setFocusedIndex(activeIndex)
  }, [activeIndex])

  useInput(
    (_input, key) => {
      if (!isActive) return

      if (key.leftArrow) {
        const next = focusedIndex <= 0 ? CATEGORIES.length - 1 : focusedIndex - 1
        setFocusedIndex(next)
        const cat = CATEGORIES[next]!
        onSelect(cat.id === 'all' ? null : cat.id)
        return
      }
      if (key.rightArrow) {
        const next = focusedIndex >= CATEGORIES.length - 1 ? 0 : focusedIndex + 1
        setFocusedIndex(next)
        const cat = CATEGORIES[next]!
        onSelect(cat.id === 'all' ? null : cat.id)
        return
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="row" gap={0}>
      {CATEGORIES.map((cat, i) => {
        const isCurrent = i === focusedIndex
        return (
          <Text
            key={cat.id}
            inverse={isCurrent}
            bold={isCurrent}
            color={isCurrent ? colors.primary : undefined}
            dimColor={!isCurrent}
          >
            {' '}{cat.label}{' '}
          </Text>
        )
      })}
    </Box>
  )
}

export { CATEGORIES }
export default CategoryPicker
