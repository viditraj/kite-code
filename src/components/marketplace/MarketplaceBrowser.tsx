/**
 * MarketplaceBrowser — Full interactive browsing screen for the MCP marketplace.
 *
 * Orchestrates the complete marketplace experience:
 * - CategoryPicker tabs along the top for category switching
 * - Scrollable server list with ServerCard rows and arrow-key navigation
 * - ServerDetailPane when the user drills into a server
 * - InstallConfirmDialog before writing config
 * - MarketplaceSearch overlay when the user presses /
 * - KeyboardShortcutHint bar at the bottom
 *
 * This replaces the static text output of `/marketplace browse`.
 *
 * @example
 * <MarketplaceBrowser
 *   onExit={() => setScreen('prompt')}
 *   onInstalled={(name) => addSystemMessage(`Installed ${name}`)}
 *   cwd={process.cwd()}
 * />
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { getActiveColors } from '../../themes/activeTheme.js'
import { useTerminalSize } from '../../ink/hooks/useTerminalSize.js'
import { CategoryPicker } from './CategoryPicker.js'
import { ServerCard } from './ServerCard.js'
import { ServerDetailPane } from './ServerDetailPane.js'
import { InstallConfirmDialog } from './InstallConfirmDialog.js'
import { MarketplaceSearch } from './MarketplaceSearch.js'
import type { MarketplaceServer, MarketplaceServerDetail, MarketplaceCategory } from '../../services/marketplace/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketplaceBrowserProps = {
  /** Called when the user exits the marketplace (Esc from root). */
  onExit: () => void
  /** Called after a server is successfully installed. */
  onInstalled?: (serverName: string, message: string) => void
  /** Current working directory for install scope. */
  cwd: string
  /** Whether this component is active. @default true */
  isActive?: boolean
}

type View = 'browse' | 'detail' | 'search' | 'install-confirm'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Chrome lines: title(1)+margin(1) + tabs(1)+margin(1) + scroll indicator(1) + hints(1)+margin(1) = 7
const CHROME_LINES = 7
// Each ServerCard = name(1) + description(1) + id(1) + bottom margin(1) = 4 lines
const LINES_PER_CARD = 4

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketplaceBrowser({
  onExit,
  onInstalled,
  cwd,
  isActive = true,
}: MarketplaceBrowserProps): React.ReactElement {
  const colors = getActiveColors()
  const { rows } = useTerminalSize()

  // Dynamically compute how many cards fit in the terminal
  const visibleCount = useMemo(
    () => Math.max(2, Math.floor((rows - CHROME_LINES) / LINES_PER_CARD)),
    [rows],
  )

  // View state
  const [view, setView] = useState<View>('browse')
  const [category, setCategory] = useState<string | null>(null)

  // Server list state
  const [servers, setServers] = useState<MarketplaceServer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail state
  const [detail, setDetail] = useState<MarketplaceServerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Install state
  const [installResult, setInstallResult] = useState<string | null>(null)

  // ------------------------------------------------------------------
  // Fetch servers for current category
  // ------------------------------------------------------------------
  const fetchServers = useCallback(async (cat: string | null) => {
    setIsLoading(true)
    setError(null)
    try {
      const { browseServers } = await import('../../services/marketplace/client.js')
      const result = await browseServers({
        category: cat as MarketplaceCategory | undefined,
        sort: 'name',
        page: 1,
      })
      setServers(result.servers)
      setTotalCount(result.totalCount)
      setFocusedIndex(0)
    } catch (err: unknown) {
      setError((err as Error).message)
      setServers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    void fetchServers(category)
  }, [category, fetchServers])

  // ------------------------------------------------------------------
  // Fetch detail for a server
  // ------------------------------------------------------------------
  const openDetail = useCallback(async (server: MarketplaceServer) => {
    setDetailLoading(true)
    setView('detail')
    try {
      const { getServerDetail } = await import('../../services/marketplace/client.js')
      const d = await getServerDetail(server.path)
      setDetail(d)
    } catch {
      setDetail({
        ...server,
        isSponsor: false,
        longDescription: '',
        githubUrl: undefined,
        standardConfig: undefined,
        npmPackage: undefined,
      })
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ------------------------------------------------------------------
  // Install handler
  // ------------------------------------------------------------------
  const doInstall = useCallback(async () => {
    if (!detail?.standardConfig) return
    try {
      const { installMCPServer } = await import('../../services/marketplace/installer.js')
      const result = installMCPServer(detail.standardConfig, 'project', cwd)
      setInstallResult(result.message)
      if (result.success) {
        onInstalled?.(result.serverName, result.message)
      }
      setView('detail')
    } catch (err: unknown) {
      setInstallResult(`Install failed: ${(err as Error).message}`)
      setView('detail')
    }
  }, [detail, cwd, onInstalled])

  // ------------------------------------------------------------------
  // Browse view keyboard handler
  // ------------------------------------------------------------------
  useInput(
    (input, key) => {
      if (!isActive || view !== 'browse') return

      // Arrow navigation
      if (key.upArrow) {
        setFocusedIndex(prev => Math.max(0, prev - 1))
        return
      }
      if (key.downArrow) {
        setFocusedIndex(prev => Math.min(servers.length - 1, prev + 1))
        return
      }

      // Enter or 'i' → detail
      if (key.return || input === 'i') {
        const server = servers[focusedIndex]
        if (server) void openDetail(server)
        return
      }

      // '/' → search mode
      if (input === '/') {
        setView('search')
        return
      }

      // Esc → exit
      if (key.escape) {
        onExit()
        return
      }
    },
    { isActive: isActive && view === 'browse' },
  )

  // ------------------------------------------------------------------
  // Category change handler
  // ------------------------------------------------------------------
  const handleCategoryChange = useCallback((catId: string | null) => {
    setCategory(catId)
  }, [])

  // ------------------------------------------------------------------
  // Search handlers
  // ------------------------------------------------------------------
  const handleSearchSelect = useCallback((server: MarketplaceServer) => {
    void openDetail(server)
  }, [openDetail])

  const handleSearchCancel = useCallback(() => {
    setView('browse')
  }, [])

  // ------------------------------------------------------------------
  // Detail handlers
  // ------------------------------------------------------------------
  const handleDetailInstall = useCallback(() => {
    if (!detail?.standardConfig) return
    setView('install-confirm')
  }, [detail])

  const handleDetailBack = useCallback(() => {
    setDetail(null)
    setInstallResult(null)
    setView('browse')
  }, [])

  // ------------------------------------------------------------------
  // Install confirm handlers
  // ------------------------------------------------------------------
  const handleInstallConfirm = useCallback(() => {
    void doInstall()
  }, [doInstall])

  const handleInstallCancel = useCallback(() => {
    setView('detail')
  }, [])

  // ------------------------------------------------------------------
  // Windowed list for browse view
  // ------------------------------------------------------------------
  const windowStart = Math.max(
    0,
    Math.min(
      focusedIndex - Math.floor(visibleCount / 2),
      servers.length - visibleCount,
    ),
  )
  const visibleServers = servers.slice(windowStart, windowStart + visibleCount)

  // ------------------------------------------------------------------
  // Render: Search overlay
  // ------------------------------------------------------------------
  if (view === 'search') {
    return (
      <MarketplaceSearch
        onSelect={handleSearchSelect}
        onCancel={handleSearchCancel}
        isActive={isActive}
      />
    )
  }

  // ------------------------------------------------------------------
  // Render: Install confirmation
  // ------------------------------------------------------------------
  if (view === 'install-confirm' && detail?.standardConfig) {
    const cfg = detail.standardConfig
    return (
      <InstallConfirmDialog
        serverName={cfg.serverName}
        command={cfg.config.command}
        args={cfg.config.args}
        npmPackage={detail.npmPackage}
        configPath={`${cwd}/.mcp.json`}
        isOpen={true}
        onConfirm={handleInstallConfirm}
        onCancel={handleInstallCancel}
        isActive={isActive}
      />
    )
  }

  // ------------------------------------------------------------------
  // Render: Server detail
  // ------------------------------------------------------------------
  if (view === 'detail') {
    if (detailLoading || !detail) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.primary}>Loading server details...</Text>
          <Text dimColor>{'\u2591'.repeat(30)}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <ServerDetailPane
          detail={detail}
          onInstall={handleDetailInstall}
          onBack={handleDetailBack}
          isActive={isActive}
        />
        {installResult && (
          <Box marginTop={1}>
            <Text color={installResult.startsWith('Install failed') ? colors.error : colors.success}>
              {installResult}
            </Text>
          </Box>
        )}
      </Box>
    )
  }

  // ------------------------------------------------------------------
  // Render: Browse (default)
  // ------------------------------------------------------------------
  return (
    <Box flexDirection="column">
      {/* Title — fixed layout, spinner appended without shifting */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>MCP Marketplace</Text>
        {isLoading
          ? <Text color={colors.warning}>{' \u27F3 loading\u2026'}</Text>
          : <Text dimColor>{' \u2014 '}{category ?? 'all'} ({totalCount.toLocaleString()})</Text>
        }
      </Box>

      {/* Category tabs — left/right to switch */}
      <Box marginBottom={1}>
        <CategoryPicker
          activeCategory={category}
          onSelect={handleCategoryChange}
          isActive={isActive && view === 'browse'}
        />
      </Box>

      {/* Server list — keep previous list visible during loading to prevent layout shift */}
      {error ? (
        <Text color={colors.error}>Error: {error}</Text>
      ) : servers.length === 0 && !isLoading ? (
        <Text dimColor>No servers found in this category.</Text>
      ) : servers.length === 0 && isLoading ? (
        <Box flexDirection="column">
          {Array.from({ length: 3 }, (_, i) => (
            <Text key={i} dimColor>{'\u2591'.repeat(20 + i * 5)}</Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {visibleServers.map((server, i) => {
            const actualIndex = windowStart + i
            return (
              <Box key={server.path} marginBottom={1}>
                <ServerCard
                  name={server.name}
                  description={server.description}
                  path={server.path}
                  isOfficial={server.isOfficial}
                  isFocused={actualIndex === focusedIndex}
                  index={actualIndex + 1}
                />
              </Box>
            )
          })}

          {/* Scroll indicators */}
          {servers.length > visibleCount && (
            <Text dimColor>
              {windowStart > 0 ? '\u2191 ' : '  '}
              {focusedIndex + 1}/{servers.length}
              {windowStart + visibleCount < servers.length ? ' \u2193' : ''}
              {totalCount > servers.length ? ` (${totalCount.toLocaleString()} total)` : ''}
            </Text>
          )}
        </Box>
      )}

      {/* Keyboard hints */}
      <Box marginTop={1} flexDirection="row" gap={2}>
        <Box>
          <Text inverse bold>{' \u2191\u2193 '}</Text>
          <Text dimColor> navigate</Text>
        </Box>
        <Box>
          <Text inverse bold>{' Enter '}</Text>
          <Text dimColor> details</Text>
        </Box>
        <Box>
          <Text inverse bold>{' / '}</Text>
          <Text dimColor> search</Text>
        </Box>
        <Box>
          <Text inverse bold>{' \u2190\u2192 '}</Text>
          <Text dimColor> category</Text>
        </Box>
        <Box>
          <Text inverse bold>{' Esc '}</Text>
          <Text dimColor> exit</Text>
        </Box>
      </Box>
    </Box>
  )
}

export default MarketplaceBrowser
