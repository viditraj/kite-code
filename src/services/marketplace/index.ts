/**
 * MCP Marketplace — browse, search, and install MCP servers and skills
 * from the mcpservers.org marketplace.
 */

export type {
  MarketplaceServer,
  MarketplaceServerDetail,
  MarketplaceSkill,
  MarketplaceCategory,
  MarketplaceSearchOptions,
  MCPInstallConfig,
  InstallScope,
} from './types.js'

export {
  browseServers,
  searchServers,
  getServerDetail,
  browseSkills,
  getCategories,
} from './client.js'

export type { InstallResult } from './installer.js'

export {
  installMCPServer,
  installFromMarketplace,
  uninstallMCPServer,
  listInstalledServers,
} from './installer.js'
