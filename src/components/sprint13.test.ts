import { describe, it, expect } from 'vitest'

describe('Sprint 13 - Advanced UI Components', () => {
  describe('DiffView', () => {
    it('exports all components and utilities', async () => {
      const mod = await import('./diff/DiffView.js')
      expect(mod.DiffView).toBeDefined()
      expect(mod.DiffFileView).toBeDefined()
      expect(mod.DiffHunkView).toBeDefined()
      expect(mod.DiffSummary).toBeDefined()
      expect(mod.parsePatch).toBeDefined()
      expect(mod.computeDiffStats).toBeDefined()
    })

    it('parsePatch parses unified diff', async () => {
      const { parsePatch } = await import('./diff/DiffView.js')
      const patch = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
-old line 2
+new line 2
+new line 3
 line 3`
      const diffs = parsePatch(patch)
      expect(diffs.length).toBeGreaterThan(0)
      expect(diffs[0]!.filePath).toContain('file.txt')
      expect(diffs[0]!.hunks.length).toBeGreaterThan(0)
    })

    it('parsePatch handles empty input', async () => {
      const { parsePatch } = await import('./diff/DiffView.js')
      expect(parsePatch('')).toEqual([])
    })

    it('computeDiffStats calculates correctly', async () => {
      const { parsePatch, computeDiffStats } = await import('./diff/DiffView.js')
      const patch = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
 line 1
+added line
 line 2`
      const diffs = parsePatch(patch)
      const stats = computeDiffStats(diffs)
      expect(stats.additions).toBeGreaterThanOrEqual(1)
      expect(stats.filesChanged).toBeGreaterThanOrEqual(1)
    })
  })

  describe('HighlightedCode', () => {
    it('exports all components and utilities', async () => {
      const mod = await import('./HighlightedCode/HighlightedCode.js')
      expect(mod.HighlightedCode).toBeDefined()
      expect(mod.CodeBlock).toBeDefined()
      expect(mod.InlineCode).toBeDefined()
      expect(mod.detectLanguage).toBeDefined()
      expect(mod.tokenizeLine).toBeDefined()
    })

    it('detectLanguage identifies TypeScript', async () => {
      const { detectLanguage } = await import('./HighlightedCode/HighlightedCode.js')
      expect(detectLanguage('file.ts')).toBe('typescript')
      expect(detectLanguage('file.tsx')).toBe('typescript')
    })

    it('detectLanguage identifies Python', async () => {
      const { detectLanguage } = await import('./HighlightedCode/HighlightedCode.js')
      expect(detectLanguage('script.py')).toBe('python')
    })

    it('detectLanguage identifies JavaScript', async () => {
      const { detectLanguage } = await import('./HighlightedCode/HighlightedCode.js')
      expect(detectLanguage('app.js')).toBe('javascript')
      expect(detectLanguage('app.jsx')).toBe('javascript')
    })

    it('detectLanguage defaults to text', async () => {
      const { detectLanguage } = await import('./HighlightedCode/HighlightedCode.js')
      expect(detectLanguage('unknownfile.xyz')).toBe('text')
    })

    it('tokenizeLine returns tokens', async () => {
      const { tokenizeLine } = await import('./HighlightedCode/HighlightedCode.js')
      const tokens = tokenizeLine('const x = 42', 'typescript')
      expect(tokens.length).toBeGreaterThan(0)
      // Should have at least a keyword token for 'const'
      const hasKeyword = tokens.some(t => t.color && t.text.includes('const'))
      expect(hasKeyword).toBe(true)
    })

    it('tokenizeLine handles comments', async () => {
      const { tokenizeLine } = await import('./HighlightedCode/HighlightedCode.js')
      const tokens = tokenizeLine('// this is a comment', 'typescript')
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('tokenizeLine handles strings', async () => {
      const { tokenizeLine } = await import('./HighlightedCode/HighlightedCode.js')
      const tokens = tokenizeLine('const s = "hello"', 'typescript')
      const hasString = tokens.some(t => t.text.includes('"hello"'))
      expect(hasString).toBe(true)
    })
  })

  describe('Settings', () => {
    it('exports all components and utilities', async () => {
      const mod = await import('./Settings/Settings.js')
      expect(mod.Settings).toBeDefined()
      expect(mod.StatusTab).toBeDefined()
      expect(mod.ConfigTab).toBeDefined()
      expect(mod.UsageTab).toBeDefined()
      expect(mod.buildDiagnostics).toBeDefined()
    })

    it('buildDiagnostics returns diagnostic items', async () => {
      const { buildDiagnostics } = await import('./Settings/Settings.js')
      const diagnostics = buildDiagnostics()
      expect(Array.isArray(diagnostics)).toBe(true)
      expect(diagnostics.length).toBeGreaterThan(3)

      // Each item has label, value, status
      for (const d of diagnostics) {
        expect(d.label).toBeTruthy()
        expect(d.value).toBeTruthy()
        expect(['ok', 'warning', 'error']).toContain(d.status)
      }
    })

    it('buildDiagnostics includes Node.js version', async () => {
      const { buildDiagnostics } = await import('./Settings/Settings.js')
      const diagnostics = buildDiagnostics()
      const nodeItem = diagnostics.find(d => d.label.toLowerCase().includes('node'))
      expect(nodeItem).toBeDefined()
      expect(nodeItem!.value).toContain(process.version.slice(1))
    })
  })

  describe('TasksView', () => {
    it('exports all components and utilities', async () => {
      const mod = await import('./tasks/TasksView.js')
      expect(mod.TaskList).toBeDefined()
      expect(mod.TaskRow).toBeDefined()
      expect(mod.TaskDetailView).toBeDefined()
      expect(mod.BackgroundTasksBar).toBeDefined()
      expect(mod.TaskProgressIndicator).toBeDefined()
      expect(mod.isTerminalStatus).toBeDefined()
      expect(mod.getTaskStatusIcon).toBeDefined()
      expect(mod.getTaskStatusColor).toBeDefined()
      expect(mod.formatTaskDuration).toBeDefined()
    })

    it('isTerminalStatus identifies terminal states', async () => {
      const { isTerminalStatus } = await import('./tasks/TasksView.js')
      expect(isTerminalStatus('completed')).toBe(true)
      expect(isTerminalStatus('failed')).toBe(true)
      expect(isTerminalStatus('killed')).toBe(true)
      expect(isTerminalStatus('running')).toBe(false)
      expect(isTerminalStatus('pending')).toBe(false)
    })

    it('getTaskStatusIcon returns icons', async () => {
      const { getTaskStatusIcon } = await import('./tasks/TasksView.js')
      expect(getTaskStatusIcon('completed')).toBeTruthy()
      expect(getTaskStatusIcon('failed')).toBeTruthy()
      expect(getTaskStatusIcon('running')).toBeTruthy()
      expect(getTaskStatusIcon('pending')).toBeTruthy()
    })

    it('getTaskStatusColor returns colors', async () => {
      const { getTaskStatusColor } = await import('./tasks/TasksView.js')
      expect(getTaskStatusColor('completed')).toBe('green')
      expect(getTaskStatusColor('failed')).toBe('red')
    })

    it('formatTaskDuration formats correctly', async () => {
      const { formatTaskDuration } = await import('./tasks/TasksView.js')
      expect(formatTaskDuration(500)).toBe('<1s')
      expect(formatTaskDuration(5000)).toBe('5s')
      expect(formatTaskDuration(90000)).toContain('m')
    })
  })
})
