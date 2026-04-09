/**
 * MCP Marketplace type definitions.
 *
 * Types for browsing, searching, and installing MCP servers and agent skills
 * from the mcpservers.org marketplace.
 */

// ============================================================================
// Marketplace Server Entry
// ============================================================================

export interface MarketplaceServer {
  /** Display name (e.g. "Playwright") */
  name: string
  /** Short description */
  description: string
  /** URL path on mcpservers.org (e.g. "/servers/microsoft/playwright-mcp") */
  path: string
  /** Whether this is an official server */
  isOfficial: boolean
  /** Whether this is a sponsored listing */
  isSponsor: boolean
  /** Category (e.g. "search", "development", "database") */
  category?: string
}

// ============================================================================
// Marketplace Server Detail (from detail page)
// ============================================================================

export interface MarketplaceServerDetail extends MarketplaceServer {
  /** GitHub repository URL */
  githubUrl?: string
  /** Full README / long description */
  longDescription: string
  /** Standard MCP config JSON (parsed from the detail page) */
  standardConfig?: MCPInstallConfig
  /** NPM package name if detectable */
  npmPackage?: string
}

// ============================================================================
// Marketplace Skill Entry
// ============================================================================

export interface MarketplaceSkill {
  /** Skill name (e.g. "Frontend Design") */
  name: string
  /** Author/publisher */
  author: string
  /** Short description */
  description: string
  /** URL path on mcpservers.org */
  path: string
  /** Category group (e.g. "Document Skills", "Development Skills") */
  category?: string
}

// ============================================================================
// Install Config (standard MCP server config from marketplace)
// ============================================================================

export interface MCPInstallConfig {
  /** Server name key (e.g. "playwright") */
  serverName: string
  /** The config object to write to .mcp.json */
  config: {
    command: string
    args?: string[]
    env?: Record<string, string>
    type?: 'stdio' | 'sse' | 'http'
    url?: string
    headers?: Record<string, string>
  }
}

// ============================================================================
// Search/Browse Options
// ============================================================================

export type MarketplaceCategory =
  | 'search'
  | 'web-scraping'
  | 'communication'
  | 'productivity'
  | 'development'
  | 'database'
  | 'cloud-service'
  | 'file-system'
  | 'cloud-storage'
  | 'version-control'
  | 'other'

export type MarketplaceSortOrder = 'name' | 'newest'

export interface MarketplaceSearchOptions {
  /** Category filter */
  category?: MarketplaceCategory
  /** Sort order */
  sort?: MarketplaceSortOrder
  /** Page number (1-based) */
  page?: number
  /** Only show official servers */
  officialOnly?: boolean
}

// ============================================================================
// Install Scope
// ============================================================================

export type InstallScope = 'project' | 'user'
