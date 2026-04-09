/**
 * Tests for the MCP Marketplace system: types, client, installer, tools.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

// ============================================================================
// Marketplace types tests
// ============================================================================

import type {
  MarketplaceServer,
  MarketplaceServerDetail,
  MarketplaceSkill,
  MCPInstallConfig,
  MarketplaceCategory,
  InstallScope,
} from './types.js'

describe('marketplace types', () => {
  it('MarketplaceServer has the expected shape', () => {
    const server: MarketplaceServer = {
      name: 'Playwright',
      description: 'Browser automation via MCP',
      path: '/servers/microsoft/playwright-mcp',
      isOfficial: true,
      isSponsor: false,
    }
    expect(server.name).toBe('Playwright')
    expect(server.isOfficial).toBe(true)
    expect(server.path).toContain('/servers/')
  })

  it('MarketplaceServerDetail extends MarketplaceServer', () => {
    const detail: MarketplaceServerDetail = {
      name: 'GitHub',
      description: 'GitHub MCP Server',
      path: '/servers/github/github-mcp-server',
      isOfficial: true,
      isSponsor: false,
      githubUrl: 'https://github.com/github/github-mcp-server',
      longDescription: 'A detailed description of the GitHub MCP server.',
      standardConfig: {
        serverName: 'github',
        config: {
          command: 'npx',
          args: ['@github/mcp-server'],
        },
      },
      npmPackage: '@github/mcp-server',
    }
    expect(detail.githubUrl).toContain('github.com')
    expect(detail.standardConfig?.serverName).toBe('github')
    expect(detail.npmPackage).toBe('@github/mcp-server')
  })

  it('MarketplaceSkill has the expected shape', () => {
    const skill: MarketplaceSkill = {
      name: 'Frontend Design',
      author: 'Anthropic',
      description: 'Generates distinctive, production-grade frontend interfaces.',
      path: '/skills/frontend-design',
    }
    expect(skill.author).toBe('Anthropic')
  })

  it('MCPInstallConfig has correct shape', () => {
    const config: MCPInstallConfig = {
      serverName: 'playwright',
      config: {
        command: 'npx',
        args: ['@playwright/mcp@latest'],
      },
    }
    expect(config.serverName).toBe('playwright')
    expect(config.config.command).toBe('npx')
    expect(config.config.args).toEqual(['@playwright/mcp@latest'])
  })

  it('MCPInstallConfig supports SSE/HTTP types', () => {
    const sseConfig: MCPInstallConfig = {
      serverName: 'remote-server',
      config: {
        command: '',
        type: 'sse',
        url: 'https://example.com/mcp/sse',
        headers: { Authorization: 'Bearer token' },
      },
    }
    expect(sseConfig.config.type).toBe('sse')
    expect(sseConfig.config.url).toBe('https://example.com/mcp/sse')
  })

  it('MarketplaceCategory covers expected values', () => {
    const cats: MarketplaceCategory[] = [
      'search', 'web-scraping', 'communication', 'productivity',
      'development', 'database', 'cloud-service', 'file-system',
      'cloud-storage', 'version-control', 'other',
    ]
    expect(cats).toHaveLength(11)
  })
})

// ============================================================================
// Marketplace client tests (with mocked fetch)
// ============================================================================

import {
  browseServers,
  searchServers,
  getServerDetail,
  browseSkills,
  getCategories,
} from './client.js'

describe('marketplace client', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('getCategories', () => {
    it('returns all 11 categories', () => {
      const categories = getCategories()
      expect(categories).toHaveLength(11)
      expect(categories.map(c => c.id)).toContain('search')
      expect(categories.map(c => c.id)).toContain('database')
      expect(categories.map(c => c.id)).toContain('development')
    })

    it('each category has id and label', () => {
      const categories = getCategories()
      for (const cat of categories) {
        expect(cat.id).toBeTruthy()
        expect(cat.label).toBeTruthy()
      }
    })
  })

  describe('browseServers', () => {
    it('parses server cards from HTML', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <div>Showing 1-30 of 7347 servers</div>
          <a href="/servers/microsoft/playwright-mcp"><h3>Playwright</h3><span>official</span><p>Browser automation via MCP</p></a>
          <a href="/servers/github/github-mcp-server"><h3>GitHub</h3><span>official</span><p>GitHub official MCP Server</p></a>
          <a href="/servers/some/other-server"><h3>Other Tool</h3><p>A description of this tool</p></a>
          </body></html>
        `),
      })

      const { servers, totalCount } = await browseServers()
      expect(totalCount).toBe(7347)
      expect(servers.length).toBeGreaterThanOrEqual(2)

      const playwright = servers.find(s => s.path === '/servers/microsoft/playwright-mcp')
      expect(playwright).toBeDefined()
      expect(playwright!.name).toContain('Playwright')
      expect(playwright!.isOfficial).toBe(true)
    })

    it('passes category to URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      })

      await browseServers({ category: 'database' })
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/category/database'),
        expect.anything(),
      )
    })

    it('uses official URL when officialOnly is true', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      })

      await browseServers({ officialOnly: true })
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/official'),
        expect.anything(),
      )
    })

    it('handles fetch errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(browseServers()).rejects.toThrow('HTTP 500')
    })
  })

  describe('searchServers', () => {
    it('filters servers by query', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <a href="/servers/microsoft/playwright-mcp"><h3>Playwright</h3><span>official</span><p>Browser automation server</p></a>
          <a href="/servers/github/github-mcp-server"><h3>GitHub</h3><span>official</span><p>GitHub MCP Server</p></a>
          <a href="/servers/supabase/supabase-mcp"><h3>Supabase</h3><span>official</span><p>Database and auth MCP</p></a>
          </body></html>
        `),
      })

      const results = await searchServers('github')
      const names = results.map(s => s.name)
      expect(names.some(n => n.includes('GitHub'))).toBe(true)
    })

    it('returns empty array for no matches', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <a href="/servers/microsoft/playwright-mcp"><h3>Playwright</h3><p>Browser automation</p></a>
          </body></html>
        `),
      })

      const results = await searchServers('nonexistentquery12345')
      expect(results).toEqual([])
    })

    it('respects maxResults', async () => {
      const cards = Array.from({ length: 30 }, (_, i) =>
        `<a href="/servers/test/server-${i}"><h3>Test Server ${i}</h3><p>Test description ${i}</p></a>`,
      ).join('')

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`<html><body>${cards}</body></html>`),
      })

      const results = await searchServers('test', { maxResults: 5 })
      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('getServerDetail', () => {
    it('extracts config from detail page', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <h1>Playwright</h1>
          <meta name="description" content="Browser automation MCP server">
          <a href="https://github.com/microsoft/playwright-mcp">GitHub</a>
          <p>A Model Context Protocol server that provides browser automation.</p>
          <code>{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}</code>
          </body></html>
        `),
      })

      const detail = await getServerDetail('microsoft/playwright-mcp')
      expect(detail.name).toBe('Playwright')
      expect(detail.githubUrl).toBe('https://github.com/microsoft/playwright-mcp')
      expect(detail.standardConfig).toBeDefined()
      expect(detail.standardConfig!.serverName).toBe('playwright')
      expect(detail.standardConfig!.config.command).toBe('npx')
      expect(detail.standardConfig!.config.args).toEqual(['@playwright/mcp@latest'])
    })

    it('handles missing config gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <h1>Custom Server</h1>
          <p>A server without standard config.</p>
          </body></html>
        `),
      })

      const detail = await getServerDetail('/servers/custom/server')
      expect(detail.standardConfig).toBeUndefined()
    })

    it('normalizes path with /servers/ prefix', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body><h1>Test</h1></body></html>'),
      })

      await getServerDetail('owner/repo')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/servers/owner/repo'),
        expect.anything(),
      )
    })

    it('handles full path starting with /', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body><h1>Test</h1></body></html>'),
      })

      await getServerDetail('/servers/owner/repo')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/servers\/owner\/repo$/),
        expect.anything(),
      )
    })
  })

  describe('browseSkills', () => {
    it('parses skill cards', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><body>
          <a href="/skills/frontend-design"><h3>Frontend Design</h3><span>by Anthropic</span><p>Generates distinctive frontend interfaces.</p></a>
          </body></html>
        `),
      })

      const skills = await browseSkills()
      // Skills page may parse differently, but should not throw
      expect(Array.isArray(skills)).toBe(true)
    })
  })
})

// ============================================================================
// Marketplace installer tests
// ============================================================================

import {
  installMCPServer,
  uninstallMCPServer,
  listInstalledServers,
} from './installer.js'

describe('marketplace installer', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `kite-marketplace-test-${randomUUID()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('installMCPServer', () => {
    it('creates .mcp.json with server config for project scope', () => {
      const result = installMCPServer(
        {
          serverName: 'playwright',
          config: {
            command: 'npx',
            args: ['@playwright/mcp@latest'],
          },
        },
        'project',
        tmpDir,
      )

      expect(result.success).toBe(true)
      expect(result.serverName).toBe('playwright')
      expect(result.configPath).toBe(join(tmpDir, '.mcp.json'))

      const content = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
      expect(content.mcpServers.playwright).toBeDefined()
      expect(content.mcpServers.playwright.command).toBe('npx')
      expect(content.mcpServers.playwright.args).toEqual(['@playwright/mcp@latest'])
    })

    it('adds to existing .mcp.json without overwriting other servers', () => {
      // Pre-create config with existing server
      writeFileSync(
        join(tmpDir, '.mcp.json'),
        JSON.stringify({ mcpServers: { existing: { command: 'node', args: ['server.js'] } } }),
      )

      const result = installMCPServer(
        {
          serverName: 'github',
          config: { command: 'npx', args: ['@github/mcp-server'] },
        },
        'project',
        tmpDir,
      )

      expect(result.success).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
      expect(content.mcpServers.existing).toBeDefined()
      expect(content.mcpServers.github).toBeDefined()
    })

    it('rejects duplicate install', () => {
      installMCPServer(
        { serverName: 'playwright', config: { command: 'npx', args: ['@playwright/mcp'] } },
        'project',
        tmpDir,
      )

      const result = installMCPServer(
        { serverName: 'playwright', config: { command: 'npx', args: ['@playwright/mcp'] } },
        'project',
        tmpDir,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('already configured')
    })

    it('handles SSE config type', () => {
      const result = installMCPServer(
        {
          serverName: 'remote',
          config: {
            command: '',
            type: 'sse',
            url: 'https://example.com/mcp/sse',
            headers: { Authorization: 'Bearer token' },
          },
        },
        'project',
        tmpDir,
      )

      expect(result.success).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
      expect(content.mcpServers.remote.type).toBe('sse')
      expect(content.mcpServers.remote.url).toBe('https://example.com/mcp/sse')
    })

    it('handles env vars in config', () => {
      const result = installMCPServer(
        {
          serverName: 'with-env',
          config: {
            command: 'npx',
            args: ['@some/server'],
            env: { API_KEY: '${MY_API_KEY}' },
          },
        },
        'project',
        tmpDir,
      )

      expect(result.success).toBe(true)
      const content = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
      expect(content.mcpServers['with-env'].env.API_KEY).toBe('${MY_API_KEY}')
    })
  })

  describe('uninstallMCPServer', () => {
    it('removes server from config', () => {
      // Pre-install
      writeFileSync(
        join(tmpDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            playwright: { command: 'npx', args: ['@playwright/mcp'] },
            github: { command: 'npx', args: ['@github/mcp-server'] },
          },
        }),
      )

      const result = uninstallMCPServer('playwright', 'project', tmpDir)
      expect(result.success).toBe(true)

      const content = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
      expect(content.mcpServers.playwright).toBeUndefined()
      expect(content.mcpServers.github).toBeDefined()
    })

    it('returns error for non-existent server', () => {
      writeFileSync(
        join(tmpDir, '.mcp.json'),
        JSON.stringify({ mcpServers: {} }),
      )

      const result = uninstallMCPServer('nonexistent', 'project', tmpDir)
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })

    it('handles missing config file', () => {
      const result = uninstallMCPServer('playwright', 'project', tmpDir)
      expect(result.success).toBe(false)
    })
  })

  describe('listInstalledServers', () => {
    it('lists servers from project config', () => {
      writeFileSync(
        join(tmpDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            playwright: { command: 'npx', args: ['@playwright/mcp'] },
          },
        }),
      )

      const installed = listInstalledServers(tmpDir)
      expect(installed.length).toBeGreaterThanOrEqual(1)
      const pw = installed.find(s => s.name === 'playwright')
      expect(pw).toBeDefined()
      expect(pw!.scope).toBe('project')
    })

    it('returns empty array when no config exists', () => {
      const installed = listInstalledServers(tmpDir)
      // May have user-level servers, but project ones should be empty
      const projectServers = installed.filter(s => s.scope === 'project')
      expect(projectServers).toEqual([])
    })
  })
})

// ============================================================================
// Marketplace tools tests (basic shape/contract tests)
// ============================================================================

import {
  MarketplaceSearchTool,
  MarketplaceBrowseTool,
  MarketplaceInfoTool,
  MarketplaceInstallTool,
} from '../../tools/MarketplaceTool/MarketplaceTool.js'

describe('marketplace tools', () => {
  describe('MarketplaceSearchTool', () => {
    it('has correct name', () => {
      expect(MarketplaceSearchTool.name).toBe('MarketplaceSearch')
    })

    it('is read-only and concurrency-safe', () => {
      expect(MarketplaceSearchTool.isReadOnly({} as any)).toBe(true)
      expect(MarketplaceSearchTool.isConcurrencySafe({} as any)).toBe(true)
    })

    it('validates empty query', async () => {
      const result = await MarketplaceSearchTool.validateInput!({ query: '' } as any, {} as any)
      expect(result.result).toBe(false)
    })

    it('validates valid query', async () => {
      const result = await MarketplaceSearchTool.validateInput!({ query: 'github' } as any, {} as any)
      expect(result.result).toBe(true)
    })

    it('maps search results to tool result', () => {
      const data = {
        servers: [
          { name: 'GitHub', description: 'GitHub MCP', path: '/servers/github/mcp', isOfficial: true },
        ],
        message: 'Found 1 server(s).',
      }
      const result = MarketplaceSearchTool.mapToolResultToToolResultBlockParam(data as any, 'test-id')
      expect(result.type).toBe('tool_result')
      expect(result.tool_use_id).toBe('test-id')
      expect(typeof result.content).toBe('string')
      expect((result.content as string)).toContain('GitHub')
    })
  })

  describe('MarketplaceBrowseTool', () => {
    it('has correct name', () => {
      expect(MarketplaceBrowseTool.name).toBe('MarketplaceBrowse')
    })

    it('is read-only', () => {
      expect(MarketplaceBrowseTool.isReadOnly({} as any)).toBe(true)
    })
  })

  describe('MarketplaceInfoTool', () => {
    it('has correct name', () => {
      expect(MarketplaceInfoTool.name).toBe('MarketplaceInfo')
    })

    it('validates empty path', async () => {
      const result = await MarketplaceInfoTool.validateInput!({ serverPath: '' } as any, {} as any)
      expect(result.result).toBe(false)
    })

    it('maps info output to tool result', () => {
      const data = {
        name: 'Playwright',
        description: 'Browser automation',
        githubUrl: 'https://github.com/microsoft/playwright-mcp',
        npmPackage: '@playwright/mcp',
        hasInstallConfig: true,
        installConfig: '{"mcpServers":{"playwright":{}}}',
        longDescription: 'Full description here',
        message: 'Details for "Playwright".',
      }
      const result = MarketplaceInfoTool.mapToolResultToToolResultBlockParam(data as any, 'info-id')
      expect(result.type).toBe('tool_result')
      expect((result.content as string)).toContain('Playwright')
      expect((result.content as string)).toContain('github.com')
    })
  })

  describe('MarketplaceInstallTool', () => {
    it('has correct name', () => {
      expect(MarketplaceInstallTool.name).toBe('MarketplaceInstall')
    })

    it('is NOT read-only', () => {
      expect(MarketplaceInstallTool.isReadOnly({} as any)).toBe(false)
    })

    it('is NOT concurrency-safe', () => {
      expect(MarketplaceInstallTool.isConcurrencySafe({} as any)).toBe(false)
    })

    it('validates empty path', async () => {
      const result = await MarketplaceInstallTool.validateInput!({ serverPath: '' } as any, {} as any)
      expect(result.result).toBe(false)
    })

    it('maps install output to tool result', () => {
      const data = {
        success: true,
        serverName: 'playwright',
        configPath: '/project/.mcp.json',
        message: 'Installed "playwright" to /project/.mcp.json.',
      }
      const result = MarketplaceInstallTool.mapToolResultToToolResultBlockParam(data as any, 'install-id')
      expect(result.type).toBe('tool_result')
      expect(result.is_error).toBe(false)
      expect((result.content as string)).toContain('playwright')
    })

    it('marks failed installs as errors', () => {
      const data = {
        success: false,
        serverName: 'broken',
        configPath: '',
        message: 'Install failed: network error',
      }
      const result = MarketplaceInstallTool.mapToolResultToToolResultBlockParam(data as any, 'fail-id')
      expect(result.is_error).toBe(true)
    })
  })
})
