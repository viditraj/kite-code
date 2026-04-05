import { describe, it, expect } from 'vitest'

// Test that all component modules can be imported without errors
describe('Sprint 5 - UI Components', () => {
  describe('ink/index re-exports', () => {
    it('exports core ink primitives', async () => {
      const ink = await import('../ink/index.js')
      expect(ink.Box).toBeDefined()
      expect(ink.Text).toBeDefined()
      expect(ink.render).toBeDefined()
      expect(ink.useInput).toBeDefined()
      expect(ink.useApp).toBeDefined()
      expect(ink.Spacer).toBeDefined()
      expect(ink.Newline).toBeDefined()
      expect(ink.Static).toBeDefined()
    })

    it('exports React utilities', async () => {
      const ink = await import('../ink/index.js')
      expect(ink.useState).toBeDefined()
      expect(ink.useEffect).toBeDefined()
      expect(ink.useRef).toBeDefined()
      expect(ink.useCallback).toBeDefined()
      expect(ink.useMemo).toBeDefined()
      expect(ink.createContext).toBeDefined()
    })
  })

  describe('hooks', () => {
    it('useTerminalSize exports correctly', async () => {
      const mod = await import('../ink/hooks/useTerminalSize.js')
      expect(mod.useTerminalSize).toBeDefined()
      expect(typeof mod.useTerminalSize).toBe('function')
    })

    it('useInterval exports correctly', async () => {
      const mod = await import('../ink/hooks/useInterval.js')
      expect(mod.useInterval).toBeDefined()
      expect(typeof mod.useInterval).toBe('function')
    })
  })

  describe('Spinner', () => {
    it('exports Spinner component', async () => {
      const mod = await import('./Spinner/Spinner.js')
      expect(mod.Spinner).toBeDefined()
      expect(mod.SpinnerWithVerb).toBeDefined()
      expect(mod.SPINNER_FRAMES).toBeDefined()
      expect(mod.SPINNER_FRAMES.length).toBe(10)
    })
  })

  describe('PromptInput', () => {
    it('exports PromptInput component', async () => {
      const mod = await import('./PromptInput/PromptInput.js')
      expect(mod.PromptInput).toBeDefined()
    })
  })

  describe('MessageList', () => {
    it('exports all message components', async () => {
      const mod = await import('./messages/MessageList.js')
      expect(mod.MessageList).toBeDefined()
      expect(mod.MessageRow).toBeDefined()
      expect(mod.ToolResultMessage).toBeDefined()
      expect(mod.SystemMessage).toBeDefined()
    })
  })

  describe('PermissionRequest', () => {
    it('exports PermissionRequest component', async () => {
      const mod = await import('./permissions/PermissionRequest.js')
      expect(mod.PermissionRequest).toBeDefined()
    })
  })

  describe('LogoV2', () => {
    it('exports logo components', async () => {
      const mod = await import('./LogoV2/LogoV2.js')
      expect(mod.LogoV2).toBeDefined()
      expect(mod.CondensedLogo).toBeDefined()
    })
  })
})
