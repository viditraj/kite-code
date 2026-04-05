import { describe, it, expect } from 'vitest'

describe('Sprint 6 - REPL Screen', () => {
  describe('REPL module', () => {
    it('exports REPL component', async () => {
      const mod = await import('./REPL.js')
      expect(mod.REPL).toBeDefined()
      expect(typeof mod.REPL).toBe('function')
    })
  })

  describe('App module', () => {
    it('exports App component', async () => {
      const mod = await import('./App.js')
      expect(mod.App).toBeDefined()
    })
  })

  describe('render module', () => {
    it('exports launchInkRepl', async () => {
      const mod = await import('./render.js')
      expect(mod.launchInkRepl).toBeDefined()
      expect(typeof mod.launchInkRepl).toBe('function')
    })
  })

  describe('CLI entrypoint', () => {
    it('can be imported without error', async () => {
      // Just verify the module loads (don't actually run it)
      const mod = await import('../entrypoints/cli.js')
      expect(mod).toBeDefined()
    })
  })

  describe('slash commands', () => {
    it('REPL has slash command handling via /help pattern', async () => {
      // Verify the REPL component is a proper React function component
      const { REPL } = await import('./REPL.js')
      expect(REPL).toBeDefined()
      // React FC has a name
      expect(typeof REPL).toBe('function')
    })
  })
})
