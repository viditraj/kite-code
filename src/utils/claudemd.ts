/**
 * AGENTS.md / CLAUDE.md loading and parsing.
 *
 * Discovers, loads, and merges memory files (CLAUDE.md, AGENTS.md) from
 * user-level, project-level, and local-level sources. Supports @include
 * directives for composing memory from multiple files, YAML frontmatter,
 * and rules directories (.kite/rules/, .claude/rules/).
 *
 * Loading priority (lowest to highest):
 *   1. User memory: ~/.kite/CLAUDE.md, ~/.kite/AGENTS.md
 *   2. User rules: ~/.kite/rules/*.md
 *   3. Project dirs (root → cwd): CLAUDE.md, AGENTS.md, .kite/, .claude/
 *   4. Local memory: CLAUDE.local.md, AGENTS.local.md per project dir
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename, resolve, relative, isAbsolute, extname } from 'path'
import { homedir } from 'os'

// ============================================================================
// Constants
// ============================================================================

const MEMORY_FILENAMES = ['CLAUDE.md', 'AGENTS.md']
const LOCAL_MEMORY_FILENAMES = ['CLAUDE.local.md', 'AGENTS.local.md']
const RULES_DIR = 'rules'
const KITE_DIR = '.kite'
const CLAUDE_DIR = '.claude'
const MAX_INCLUDE_DEPTH = 10
const MAX_FILE_SIZE = 256 * 1024 // 256KB

// ============================================================================
// Types
// ============================================================================

export interface MemoryFile {
  path: string
  content: string
  source: 'managed' | 'user' | 'project' | 'local'
  type: 'memory' | 'rules'
}

// ============================================================================
// resolveIncludes
// ============================================================================

/**
 * Resolve @include directives in memory file content.
 *
 * Supports the following reference patterns:
 *   - `@path`          — relative to basePath (same as @./path)
 *   - `@./relative`    — explicit relative
 *   - `@~/home/path`   — relative to home directory
 *   - `@/absolute/path` — absolute path
 *
 * Directives inside fenced code blocks (``` delimited) or indented code
 * blocks (4+ leading spaces) are left untouched. Circular references are
 * detected via the `seen` set. Recursion is bounded by MAX_INCLUDE_DEPTH.
 * Non-existent files are silently ignored (the @reference is removed).
 *
 * @param content  - Raw file content potentially containing @references
 * @param basePath - Directory to resolve relative paths against
 * @param seen     - Set of already-included absolute paths (cycle prevention)
 * @param depth    - Current recursion depth
 * @returns Content with all @references resolved
 */
export function resolveIncludes(
  content: string,
  basePath: string,
  seen?: Set<string>,
  depth?: number,
): string {
  const currentSeen = seen ?? new Set<string>()
  const currentDepth = depth ?? 0

  if (currentDepth >= MAX_INCLUDE_DEPTH) {
    return content
  }

  const lines = content.split('\n')
  const result: string[] = []
  let inCodeBlock = false

  for (const line of lines) {
    // Track fenced code block state (``` toggle)
    const trimmedLine = line.trimStart()
    if (trimmedLine.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    // Skip lines inside code blocks
    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // Skip indented code blocks (4+ spaces or tab)
    if (line.startsWith('    ') || line.startsWith('\t')) {
      result.push(line)
      continue
    }

    // Look for @reference patterns
    // Match @ at the start of the line (after optional whitespace) or as a
    // standalone word. We process the whole line to find @references.
    const includePattern = /(?:^|\s)@(~\/[^\s]+|\.\/[^\s]+|\/[^\s]+|[^\s@]+)/g
    let match: RegExpExecArray | null
    let lastIndex = 0
    let lineResult = ''
    let hasInclude = false

    while ((match = includePattern.exec(line)) !== null) {
      const rawRef = match[1]

      // Resolve the path
      let resolvedPath: string

      if (rawRef.startsWith('~/')) {
        // Home-relative path
        resolvedPath = resolve(join(homedir(), rawRef.slice(2)))
      } else if (rawRef.startsWith('/')) {
        // Absolute path
        resolvedPath = resolve(rawRef)
      } else if (rawRef.startsWith('./')) {
        // Explicit relative path
        resolvedPath = resolve(basePath, rawRef)
      } else {
        // Bare name — treat as relative to basePath
        resolvedPath = resolve(basePath, rawRef)
      }

      // Skip if already seen (circular reference) or doesn't exist
      if (currentSeen.has(resolvedPath) || !existsSync(resolvedPath)) {
        // Leave the line as-is for this reference (silently ignore)
        continue
      }

      // Check if it's a file (not a directory) and within size limit
      try {
        const stat = statSync(resolvedPath)
        if (!stat.isFile() || stat.size > MAX_FILE_SIZE) {
          continue
        }
      } catch {
        continue
      }

      // Read and recursively resolve the included file
      try {
        const includedContent = readFileSync(resolvedPath, 'utf-8')
        const newSeen = new Set(currentSeen)
        newSeen.add(resolvedPath)

        const resolvedContent = resolveIncludes(
          includedContent,
          dirname(resolvedPath),
          newSeen,
          currentDepth + 1,
        )

        // Replace the @reference in the line with the included content
        const fullMatch = match[0]
        const matchStart = match.index
        const leadingWhitespace = fullMatch.startsWith(' ') || fullMatch.startsWith('\t') ? fullMatch[0] : ''

        lineResult += line.slice(lastIndex, matchStart)
        if (leadingWhitespace) {
          lineResult += leadingWhitespace
        }
        lineResult += resolvedContent.trimEnd()
        lastIndex = matchStart + fullMatch.length
        hasInclude = true
      } catch {
        // Read error — silently ignore
        continue
      }
    }

    if (hasInclude) {
      lineResult += line.slice(lastIndex)
      result.push(lineResult)
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

// ============================================================================
// loadMemoryFile
// ============================================================================

/**
 * Load a single memory file from disk.
 *
 * Returns null if the file does not exist, cannot be read, or exceeds
 * MAX_FILE_SIZE. Otherwise reads the content, resolves any @include
 * directives, and returns a MemoryFile object.
 *
 * @param filePath - Absolute path to the memory file
 * @param source   - Origin category ('managed', 'user', 'project', 'local')
 * @param type     - Content type ('memory' or 'rules')
 * @returns MemoryFile or null
 */
export function loadMemoryFile(
  filePath: string,
  source: MemoryFile['source'],
  type: MemoryFile['type'],
): MemoryFile | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }

    const stat = statSync(filePath)
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) {
      return null
    }

    const rawContent = readFileSync(filePath, 'utf-8')
    const content = resolveIncludes(rawContent, dirname(filePath))

    return {
      path: resolve(filePath),
      content,
      source,
      type,
    }
  } catch {
    return null
  }
}

// ============================================================================
// scanRulesDirectory
// ============================================================================

/**
 * Scan a rules directory (.kite/rules/ or .claude/rules/) for .md files.
 *
 * Lists markdown files (non-recursively) in the given directory, loads each
 * as a rules-type MemoryFile, and returns them sorted by filename for
 * deterministic ordering.
 *
 * @param dir    - Absolute path to the rules directory
 * @param source - Origin category for the loaded files
 * @returns Array of MemoryFile objects, sorted by filename
 */
export function scanRulesDirectory(
  dir: string,
  source: MemoryFile['source'],
): MemoryFile[] {
  const files: MemoryFile[] = []

  if (!existsSync(dir)) {
    return files
  }

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }

  // Filter to .md files only, sort for deterministic order
  const mdFiles = entries
    .filter((entry) => {
      if (extname(entry).toLowerCase() !== '.md') {
        return false
      }
      try {
        const entryPath = join(dir, entry)
        return statSync(entryPath).isFile()
      } catch {
        return false
      }
    })
    .sort()

  for (const filename of mdFiles) {
    const filePath = join(dir, filename)
    const memFile = loadMemoryFile(filePath, source, 'rules')
    if (memFile) {
      files.push(memFile)
    }
  }

  return files
}

// ============================================================================
// getProjectMemoryDirs
// ============================================================================

/**
 * Get directories to scan for project memory files.
 *
 * Walks from the given working directory up to the filesystem root (or the
 * user's home directory), collecting each directory along the way. The
 * returned array is ordered from cwd first (highest priority) to the
 * ancestor nearest the root (lowest priority).
 *
 * @param cwd - Starting directory (typically process.cwd())
 * @returns Array of absolute directory paths, cwd first
 */
export function getProjectMemoryDirs(cwd: string): string[] {
  const dirs: string[] = []
  const home = homedir()
  let dir = resolve(cwd)

  while (true) {
    dirs.push(dir)

    // Stop at the home directory — don't walk above it
    if (dir === home) {
      break
    }

    const parent = dirname(dir)

    // Stop at filesystem root (dirname of root is itself)
    if (parent === dir) {
      break
    }

    dir = parent
  }

  return dirs
}

// ============================================================================
// getUserMemoryDir
// ============================================================================

/**
 * Returns the user-level memory directory (~/.kite/).
 *
 * @returns Absolute path to ~/.kite/
 */
export function getUserMemoryDir(): string {
  return join(homedir(), KITE_DIR)
}

// ============================================================================
// getMemoryFiles
// ============================================================================

/**
 * Main entry point — load all memory files in priority order.
 *
 * Discovers and loads memory files from all sources:
 *   1. User memory: ~/.kite/CLAUDE.md, ~/.kite/AGENTS.md
 *   2. User rules: ~/.kite/rules/*.md
 *   3. For each project dir (root → cwd):
 *      - CLAUDE.md, AGENTS.md in the directory itself
 *      - .kite/CLAUDE.md, .kite/AGENTS.md
 *      - .claude/CLAUDE.md, .claude/AGENTS.md
 *      - .kite/rules/*.md, .claude/rules/*.md
 *   4. Local memory: CLAUDE.local.md, AGENTS.local.md in each project dir
 *
 * Files are deduplicated by resolved absolute path. The returned array is
 * ordered from lowest to highest priority (user files first, local files last).
 *
 * @param cwd - Current working directory
 * @returns Array of MemoryFile objects
 */
export function getMemoryFiles(cwd: string): MemoryFile[] {
  const files: MemoryFile[] = []
  const seenPaths = new Set<string>()

  /**
   * Helper to add a file only if its path hasn't been seen yet.
   */
  function addFile(file: MemoryFile | null): void {
    if (!file) return
    const absPath = resolve(file.path)
    if (seenPaths.has(absPath)) return
    seenPaths.add(absPath)
    files.push(file)
  }

  /**
   * Helper to add an array of files.
   */
  function addFiles(memFiles: MemoryFile[]): void {
    for (const f of memFiles) {
      addFile(f)
    }
  }

  // 1. User memory: ~/.kite/CLAUDE.md, ~/.kite/AGENTS.md
  const userDir = getUserMemoryDir()
  for (const filename of MEMORY_FILENAMES) {
    addFile(loadMemoryFile(join(userDir, filename), 'user', 'memory'))
  }

  // 2. User rules: ~/.kite/rules/*.md
  addFiles(scanRulesDirectory(join(userDir, RULES_DIR), 'user'))

  // 3. Project directories: walk from root to cwd
  //    getProjectMemoryDirs returns cwd-first, but we want root-first
  //    for lowest-to-highest priority ordering.
  const projectDirs = getProjectMemoryDirs(cwd).reverse()

  for (const dir of projectDirs) {
    // CLAUDE.md, AGENTS.md in the directory itself
    for (const filename of MEMORY_FILENAMES) {
      addFile(loadMemoryFile(join(dir, filename), 'project', 'memory'))
    }

    // .kite/CLAUDE.md, .kite/AGENTS.md
    for (const filename of MEMORY_FILENAMES) {
      addFile(loadMemoryFile(join(dir, KITE_DIR, filename), 'project', 'memory'))
    }

    // .claude/CLAUDE.md, .claude/AGENTS.md
    for (const filename of MEMORY_FILENAMES) {
      addFile(loadMemoryFile(join(dir, CLAUDE_DIR, filename), 'project', 'memory'))
    }

    // .kite/rules/*.md
    addFiles(scanRulesDirectory(join(dir, KITE_DIR, RULES_DIR), 'project'))

    // .claude/rules/*.md
    addFiles(scanRulesDirectory(join(dir, CLAUDE_DIR, RULES_DIR), 'project'))
  }

  // 4. Local memory: CLAUDE.local.md, AGENTS.local.md in each project dir
  for (const dir of projectDirs) {
    for (const filename of LOCAL_MEMORY_FILENAMES) {
      addFile(loadMemoryFile(join(dir, filename), 'local', 'memory'))
    }
  }

  return files
}

// ============================================================================
// buildMemoryPromptSection
// ============================================================================

/**
 * Build the memory section for the system prompt.
 *
 * Groups files by source and formats each file's content with a header
 * showing the source path. Returns a single string suitable for inclusion
 * in a system prompt.
 *
 * @param files - Array of MemoryFile objects to format
 * @returns Formatted string with all memory content
 */
export function buildMemoryPromptSection(files: MemoryFile[]): string {
  if (files.length === 0) {
    return ''
  }

  const sourceLabels: Record<MemoryFile['source'], string> = {
    managed: 'Managed Memory',
    user: 'User Memory',
    project: 'Project Memory',
    local: 'Local Memory',
  }

  // Group files by source, preserving order within each group
  const grouped = new Map<MemoryFile['source'], MemoryFile[]>()
  for (const file of files) {
    const group = grouped.get(file.source)
    if (group) {
      group.push(file)
    } else {
      grouped.set(file.source, [file])
    }
  }

  const sections: string[] = []

  // Emit groups in a fixed order matching the source priority
  const sourceOrder: MemoryFile['source'][] = ['managed', 'user', 'project', 'local']

  for (const source of sourceOrder) {
    const group = grouped.get(source)
    if (!group || group.length === 0) continue

    const label = sourceLabels[source]
    sections.push(`## ${label}`)

    for (const file of group) {
      const trimmedContent = file.content.trim()
      if (!trimmedContent) continue

      const typeLabel = file.type === 'rules' ? 'rules' : 'memory'
      sections.push(`### ${file.path} (${typeLabel})`)
      sections.push(trimmedContent)
      sections.push('') // blank line separator
    }
  }

  if (sections.length === 0) {
    return ''
  }

  return '# Memory Files\n\n' + sections.join('\n') + '\n'
}

// ============================================================================
// parseMemoryFrontmatter
// ============================================================================

/**
 * Parse optional YAML frontmatter from a memory file.
 *
 * Looks for `---` delimiters at the start of the content, extracts
 * key: value pairs from the block between them, and returns the parsed
 * frontmatter map along with the remaining body text.
 *
 * Reuses the same parsing approach as parseFrontmatter in loadSkillsDir.ts:
 * handles continuation lines (indented), multi-line values, and gracefully
 * falls back to empty frontmatter when no valid block is found.
 *
 * @param content - Raw memory file content
 * @returns Object with `frontmatter` map and `body` string
 */
export function parseMemoryFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const trimmed = content.trimStart()

  // Must start with --- on its own line
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  // Find the first newline after the opening ---
  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) {
    return { frontmatter: {}, body: content }
  }

  const afterOpen = trimmed.substring(firstNewline + 1)
  const closeIndex = afterOpen.indexOf('\n---')

  if (closeIndex === -1) {
    // No closing --- delimiter, treat as no frontmatter
    return { frontmatter: {}, body: content }
  }

  const frontmatterBlock = afterOpen.substring(0, closeIndex)
  const bodyStart = firstNewline + 1 + closeIndex + 4 // skip \n---
  const body = trimmed.substring(bodyStart).replace(/^\n+/, '')

  // Parse key: value pairs
  const frontmatter: Record<string, string> = {}
  const lines = frontmatterBlock.split('\n')
  let currentKey: string | null = null
  let currentValue = ''

  for (const line of lines) {
    // Skip empty lines (but append newline to multi-line values)
    if (line.trim() === '') {
      if (currentKey !== null) {
        currentValue += '\n'
      }
      continue
    }

    // Check if this is a continuation line (indented)
    if (currentKey !== null && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentValue += '\n' + line.trimStart()
      continue
    }

    // Save previous key-value pair
    if (currentKey !== null) {
      frontmatter[currentKey] = currentValue.trim()
    }

    // Parse new key: value pair
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      currentKey = null
      currentValue = ''
      continue
    }

    currentKey = line.substring(0, colonIndex).trim()
    currentValue = line.substring(colonIndex + 1).trim()
  }

  // Save last key-value pair
  if (currentKey !== null) {
    frontmatter[currentKey] = currentValue.trim()
  }

  return { frontmatter, body }
}

// ============================================================================
// Exports
// ============================================================================

export {
  MEMORY_FILENAMES,
  LOCAL_MEMORY_FILENAMES,
  RULES_DIR,
  KITE_DIR,
  CLAUDE_DIR,
  MAX_INCLUDE_DEPTH,
  MAX_FILE_SIZE,
}
