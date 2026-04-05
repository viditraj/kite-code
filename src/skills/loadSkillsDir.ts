/**
 * Skill loading from directory structure.
 *
 * Scans .kite/skills/ and .claude/skills/ directories at project and user level,
 * parsing SKILL.md files into PromptCommand objects that can be invoked as
 * slash commands. Supports frontmatter metadata, argument substitution,
 * and runtime skill registration.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, basename, dirname, relative, sep } from 'path'
import { homedir } from 'os'
import type { Command, PromptCommand } from '../types/command.js'
import type { ContentBlock } from '../providers/types.js'

// ============================================================================
// Constants
// ============================================================================

const SKILL_FILENAME = 'SKILL.md'
const KITE_SKILLS_DIR = 'skills'
const KITE_DIR = '.kite'
const CLAUDE_DIR = '.claude'

// ============================================================================
// Types
// ============================================================================

export interface SkillMetadata {
  name: string
  description: string
  arguments?: string[]
  allowedTools?: string[]
  model?: string
  context?: 'inline' | 'fork'
  agent?: string
  paths?: string[]
  hooks?: Record<string, unknown>
  skillRoot: string
  source: string
}

// ============================================================================
// Module-level state
// ============================================================================

/** Cache of loaded skill commands, keyed by directory path */
let skillCache: Map<string, Command[]> = new Map()

/** Dynamically registered skills discovered at runtime */
let dynamicSkills: Command[] = []

// ============================================================================
// parseFrontmatter
// ============================================================================

/**
 * Parse YAML-like frontmatter from a markdown file.
 *
 * Looks for `---` at the start of the content, finds the closing `---`,
 * and parses key: value pairs between them. Handles multi-line values
 * where continuation lines are indented. If no frontmatter block is found,
 * returns an empty map and the full content as body.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const trimmed = content.trimStart()

  // Must start with --- on its own line
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  // Find the closing ---
  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) {
    return { frontmatter: {}, body: content }
  }

  const afterOpen = trimmed.substring(firstNewline + 1)
  const closeIndex = afterOpen.indexOf('\n---')

  if (closeIndex === -1) {
    // No closing ---, treat as no frontmatter
    return { frontmatter: {}, body: content }
  }

  const frontmatterBlock = afterOpen.substring(0, closeIndex)
  const bodyStart = firstNewline + 1 + closeIndex + 4 // skip \n---
  const body = trimmed.substring(bodyStart).replace(/^\n+/, '')

  // Parse key: value pairs
  const frontmatter: Record<string, string> = {}
  const lines = frontmatterBlock.split('\n')
  let currentKey: string | null = null
  let currentValue: string = ''

  for (const line of lines) {
    // Skip empty lines
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
      // Not a key-value pair, skip
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
// parseSkillFile
// ============================================================================

/**
 * Parse a SKILL.md file into SkillMetadata.
 *
 * Reads the file, extracts frontmatter, and parses all supported metadata
 * fields. Argument names are extracted from `$ARGUMENTS` usage or `{{arg}}`
 * patterns in the body.
 *
 * @param filePath - Absolute path to the SKILL.md file
 * @param source - Source label (e.g. 'project', 'user')
 * @returns SkillMetadata or null if the file cannot be parsed
 */
export function parseSkillFile(
  filePath: string,
  source: string,
): SkillMetadata | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(content)

    const skillDir = dirname(filePath)
    const dirName = basename(skillDir)

    // Extract name: prefer frontmatter, fall back to directory name
    const name = frontmatter['name'] || dirName

    // Extract description: prefer frontmatter, fall back to first paragraph
    let description = frontmatter['description'] || ''
    if (!description && body) {
      // Extract first non-empty paragraph as description
      const paragraphs = body.split(/\n\n+/)
      for (const para of paragraphs) {
        const trimmedPara = para.trim()
        if (trimmedPara && !trimmedPara.startsWith('#')) {
          // Take first sentence or first 200 chars
          const firstSentence = trimmedPara.split(/\.\s/)[0]
          description = firstSentence.length < 200
            ? firstSentence + (trimmedPara.includes('. ') ? '.' : '')
            : trimmedPara.substring(0, 200) + '...'
          break
        }
      }
    }

    if (!name) {
      return null
    }

    // Parse arguments from frontmatter or body patterns
    let args: string[] | undefined
    if (frontmatter['arguments']) {
      args = frontmatter['arguments']
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
    } else {
      // Scan body for $ARGUMENTS references and {{arg}} patterns
      const argSet = new Set<string>()

      // Match $ARGUMENTS (generic placeholder)
      if (body.includes('$ARGUMENTS')) {
        argSet.add('args')
      }

      // Match {{argName}} patterns (named arguments)
      const mustachePattern = /\{\{(\w+)\}\}/g
      let match: RegExpExecArray | null
      while ((match = mustachePattern.exec(body)) !== null) {
        argSet.add(match[1])
      }

      if (argSet.size > 0) {
        args = Array.from(argSet)
      }
    }

    // Parse allowed-tools
    let allowedTools: string[] | undefined
    if (frontmatter['allowed-tools']) {
      allowedTools = frontmatter['allowed-tools']
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (frontmatter['allowedTools']) {
      allowedTools = frontmatter['allowedTools']
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }

    // Parse model
    const model = frontmatter['model'] || undefined

    // Parse context (inline or fork)
    let context: 'inline' | 'fork' | undefined
    if (frontmatter['context'] === 'inline' || frontmatter['context'] === 'fork') {
      context = frontmatter['context']
    }

    // Parse agent
    const agent = frontmatter['agent'] || undefined

    // Parse paths (glob patterns)
    let paths: string[] | undefined
    if (frontmatter['paths']) {
      paths = frontmatter['paths']
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    }

    // Parse hooks (JSON-like or simple key-value)
    let hooks: Record<string, unknown> | undefined
    if (frontmatter['hooks']) {
      try {
        hooks = JSON.parse(frontmatter['hooks'])
      } catch {
        // Treat as simple string value
        hooks = { default: frontmatter['hooks'] }
      }
    }

    return {
      name,
      description,
      arguments: args,
      allowedTools,
      model,
      context,
      agent,
      paths,
      hooks,
      skillRoot: skillDir,
      source,
    }
  } catch {
    // File read or parse error
    return null
  }
}

// ============================================================================
// loadSkillFromDir
// ============================================================================

/**
 * Load a single skill from a directory containing a SKILL.md file.
 *
 * @param skillDir - Path to the skill directory
 * @param source - Source label for the command
 * @returns A Command (PromptCommand) or null if the directory is not a valid skill
 */
export function loadSkillFromDir(
  skillDir: string,
  source: string,
): Command | null {
  const skillFilePath = join(skillDir, SKILL_FILENAME)

  if (!existsSync(skillFilePath)) {
    return null
  }

  const metadata = parseSkillFile(skillFilePath, source)
  if (!metadata) {
    return null
  }

  // Read the body for initial content length calculation
  let initialBody = ''
  try {
    const content = readFileSync(skillFilePath, 'utf-8')
    const parsed = parseFrontmatter(content)
    initialBody = parsed.body
  } catch {
    // Fall back to empty
  }

  // Normalize name: lowercase, replace spaces/underscores with hyphens
  const commandName = metadata.name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const command: Command = {
    type: 'prompt' as const,
    name: commandName,
    description: metadata.description || `Run skill: ${metadata.name}`,
    source: metadata.source as PromptCommand['source'],
    contentLength: initialBody.length,
    progressMessage: `running ${metadata.name}`,
    argNames: metadata.arguments,
    allowedTools: metadata.allowedTools,
    model: metadata.model,
    context: metadata.context,
    agent: metadata.agent,
    paths: metadata.paths,
    loadedFrom: 'skills' as const,

    async getPromptForCommand(
      args: string,
      _context,
    ): Promise<ContentBlock[]> {
      // Re-read the SKILL.md file in case it has changed since load
      let body = initialBody
      try {
        const freshContent = readFileSync(skillFilePath, 'utf-8')
        const freshParsed = parseFrontmatter(freshContent)
        body = freshParsed.body
      } catch {
        // Fall back to the initially loaded body
      }

      // Substitute $ARGUMENTS with the provided args string
      if (args) {
        body = body.replace(/\$ARGUMENTS/g, args)

        // Also substitute {{argName}} patterns
        // If there are named arguments, try to split args by whitespace
        if (metadata.arguments && metadata.arguments.length > 0) {
          const argValues = splitArguments(args, metadata.arguments.length)
          for (let i = 0; i < metadata.arguments.length; i++) {
            const argName = metadata.arguments[i]
            const argValue = argValues[i] || ''
            body = body.replace(
              new RegExp(`\\{\\{${escapeRegExp(argName)}\\}\\}`, 'g'),
              argValue,
            )
          }
        }
      } else {
        // Clear unfilled placeholders
        body = body.replace(/\$ARGUMENTS/g, '')
      }

      return [{ type: 'text', text: body }]
    },
  }

  // Copy over optional fields that CommandBase supports
  if (metadata.paths && metadata.paths.length > 0) {
    command.isHidden = true
  }

  return command
}

// ============================================================================
// Argument splitting helpers
// ============================================================================

/**
 * Split an arguments string into individual argument values.
 *
 * Handles quoted strings so that `"hello world" foo` produces
 * ['hello world', 'foo'] rather than ['hello', 'world', 'foo'].
 *
 * @param args - Raw arguments string
 * @param maxArgs - Maximum number of arguments to extract; the last
 *                  argument captures all remaining text
 * @returns Array of argument values
 */
function splitArguments(args: string, maxArgs: number): string[] {
  const result: string[] = []
  let remaining = args.trim()

  while (remaining && result.length < maxArgs - 1) {
    if (remaining.startsWith('"')) {
      // Quoted argument
      const closeQuote = remaining.indexOf('"', 1)
      if (closeQuote !== -1) {
        result.push(remaining.substring(1, closeQuote))
        remaining = remaining.substring(closeQuote + 1).trim()
      } else {
        // Unclosed quote, take everything
        result.push(remaining.substring(1))
        remaining = ''
      }
    } else if (remaining.startsWith("'")) {
      // Single-quoted argument
      const closeQuote = remaining.indexOf("'", 1)
      if (closeQuote !== -1) {
        result.push(remaining.substring(1, closeQuote))
        remaining = remaining.substring(closeQuote + 1).trim()
      } else {
        result.push(remaining.substring(1))
        remaining = ''
      }
    } else {
      // Unquoted argument — split on whitespace
      const spaceIndex = remaining.search(/\s/)
      if (spaceIndex !== -1) {
        result.push(remaining.substring(0, spaceIndex))
        remaining = remaining.substring(spaceIndex).trim()
      } else {
        result.push(remaining)
        remaining = ''
      }
    }
  }

  // Last argument captures all remaining text
  if (remaining) {
    result.push(remaining)
  }

  return result
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// getSkillsPath
// ============================================================================

/**
 * Return the skills directory path for a given source scope.
 *
 * @param source - 'project' uses cwd, 'user' and 'global' use home directory
 * @returns Absolute path to the skills directory
 */
export function getSkillsPath(source: 'project' | 'user' | 'global'): string {
  switch (source) {
    case 'project':
      return join(process.cwd(), KITE_DIR, KITE_SKILLS_DIR)
    case 'user':
    case 'global':
      return join(homedir(), KITE_DIR, KITE_SKILLS_DIR)
  }
}

// ============================================================================
// scanSkillsDirectory
// ============================================================================

/**
 * Scan a directory for skill subdirectories.
 *
 * Each subdirectory that contains a SKILL.md file is treated as a skill.
 * Non-directory entries and directories without SKILL.md are silently skipped.
 *
 * @param dir - Directory to scan
 * @param source - Source label for loaded commands
 * @returns Array of Command objects for discovered skills
 */
export function scanSkillsDirectory(dir: string, source: string): Command[] {
  if (!existsSync(dir)) {
    return []
  }

  // Check the cache first
  const cacheKey = `${dir}::${source}`
  const cached = skillCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const commands: Command[] = []

  try {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.startsWith('.')) {
        continue
      }

      const entryPath = join(dir, entry)

      try {
        const stat = statSync(entryPath)
        if (!stat.isDirectory()) {
          continue
        }
      } catch {
        // Cannot stat entry, skip it
        continue
      }

      const command = loadSkillFromDir(entryPath, source)
      if (command) {
        commands.push(command)
      }
    }
  } catch {
    // Cannot read directory — permission error, etc.
    return []
  }

  // Cache the results
  skillCache.set(cacheKey, commands)

  return commands
}

// ============================================================================
// getSkillDirCommands — main entry point
// ============================================================================

/**
 * Load all skills from all source directories.
 *
 * Scans project-level directories first (.kite/skills/ and .claude/skills/
 * relative to cwd), then user-level (~/.kite/skills/). Project skills take
 * precedence over user skills when names collide.
 *
 * @param cwd - Current working directory (project root)
 * @returns Deduplicated array of skill commands
 */
export function getSkillDirCommands(cwd: string): Command[] {
  const seen = new Map<string, Command>()

  // 1. Scan project-level skill directories
  const projectKiteSkills = join(cwd, KITE_DIR, KITE_SKILLS_DIR)
  const projectClaudeSkills = join(cwd, CLAUDE_DIR, KITE_SKILLS_DIR)

  const projectKite = scanSkillsDirectory(projectKiteSkills, 'project')
  for (const cmd of projectKite) {
    seen.set(cmd.name, cmd)
  }

  const projectClaude = scanSkillsDirectory(projectClaudeSkills, 'project')
  for (const cmd of projectClaude) {
    // .kite takes precedence over .claude if same name
    if (!seen.has(cmd.name)) {
      seen.set(cmd.name, cmd)
    }
  }

  // 2. Scan user-level skill directories
  const userSkills = join(homedir(), KITE_DIR, KITE_SKILLS_DIR)
  const userCmds = scanSkillsDirectory(userSkills, 'user')

  for (const cmd of userCmds) {
    // Project skills take precedence over user skills
    if (!seen.has(cmd.name)) {
      seen.set(cmd.name, cmd)
    }
  }

  return Array.from(seen.values())
}

// ============================================================================
// Cache management
// ============================================================================

/**
 * Clear all memoized skill data.
 *
 * Called when the skill directories may have changed (e.g. after a file
 * write to a skills directory).
 */
export function clearSkillCaches(): void {
  skillCache = new Map()
  // Note: dynamic skills are NOT cleared — they persist until the session ends
}

// ============================================================================
// Dynamic skills
// ============================================================================

/**
 * Return dynamically discovered skills.
 *
 * Dynamic skills are registered at runtime when the system discovers SKILL.md
 * files during file operations (e.g. glob, grep, file read). They supplement
 * the directory-scanned skills.
 *
 * @returns Array of dynamically registered skill commands
 */
export function getDynamicSkills(): Command[] {
  return [...dynamicSkills]
}

/**
 * Register a skill discovered during runtime.
 *
 * Prevents duplicate registration by checking the command name against
 * already-registered dynamic skills.
 *
 * @param command - The Command to register as a dynamic skill
 */
export function registerDynamicSkill(command: Command): void {
  // Prevent duplicates
  const exists = dynamicSkills.some((s) => s.name === command.name)
  if (!exists) {
    dynamicSkills.push(command)
  }
}
