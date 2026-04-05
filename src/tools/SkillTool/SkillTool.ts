/**
 * SkillTool — Execute a custom skill from .kite/skills/.
 *
 * Looks for a skill definition in .kite/skills/{skill_name}/SKILL.md,
 * reads the file, and returns its content as context for the agent.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const SKILL_TOOL_NAME = 'Skill'

const inputSchema = z.strictObject({
  skill_name: z.string().describe('Name of the skill to execute (matches folder name in .kite/skills/)'),
  arguments: z.record(z.string(), z.unknown()).optional().describe(
    'Optional arguments to pass to the skill as key-value pairs'
  ),
})

type SkillInput = z.infer<typeof inputSchema>

interface SkillOutput {
  skill_name: string
  content: string
  arguments?: Record<string, unknown>
  found: boolean
}

function findSkillFile(cwd: string, skillName: string): string | null {
  // Check .kite/skills/{name}/SKILL.md
  const primaryPath = join(cwd, '.kite', 'skills', skillName, 'SKILL.md')
  if (existsSync(primaryPath)) return primaryPath

  // Also check .kite/skills/{name}/skill.md (case-insensitive fallback)
  const fallbackPath = join(cwd, '.kite', 'skills', skillName, 'skill.md')
  if (existsSync(fallbackPath)) return fallbackPath

  // Check .kite/skills/{name}.md (flat layout)
  const flatPath = join(cwd, '.kite', 'skills', `${skillName}.md`)
  if (existsSync(flatPath)) return flatPath

  return null
}

function interpolateArguments(content: string, args: Record<string, unknown>): string {
  let result = content
  for (const [key, value] of Object.entries(args)) {
    const placeholder = `{{${key}}}`
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    result = result.split(placeholder).join(stringValue)
  }
  return result
}

export const SkillTool = buildTool({
  name: SKILL_TOOL_NAME,
  searchHint: 'execute custom skill from .kite/skills',
  maxResultSizeChars: 100_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description({ skill_name }: SkillInput) {
    return `Execute skill "${skill_name}"`
  },

  async prompt() {
    return `Execute a custom skill defined in the project's .kite/skills/ directory.

Skills are markdown files that provide context-specific guidance and instructions. They are stored in .kite/skills/{skill_name}/SKILL.md.

Input:
- skill_name: Name of the skill (matches the folder name in .kite/skills/)
- arguments: (optional) Key-value pairs that replace {{key}} placeholders in the skill content

Example:
  { "skill_name": "deploy", "arguments": { "environment": "staging" } }

This will read .kite/skills/deploy/SKILL.md and replace any {{environment}} placeholders with "staging".

Skills can provide:
- Step-by-step instructions for common workflows
- Project-specific coding patterns and conventions
- Deployment procedures
- Testing guidelines`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'Skill'
  },

  toAutoClassifierInput(input: SkillInput) {
    return `skill ${input.skill_name}`
  },

  getToolUseSummary(input?: Partial<SkillInput>) {
    if (!input?.skill_name) return null
    return `Executing skill "${input.skill_name}"`
  },

  getActivityDescription(input?: Partial<SkillInput>) {
    if (!input?.skill_name) return 'Executing skill'
    return `Executing skill "${input.skill_name}"`
  },

  async validateInput(input: SkillInput) {
    if (!input.skill_name || !input.skill_name.trim()) {
      return { result: false, message: 'skill_name cannot be empty', errorCode: 1 }
    }
    // Prevent path traversal
    if (input.skill_name.includes('..') || input.skill_name.includes('/') || input.skill_name.includes('\\')) {
      return { result: false, message: 'skill_name cannot contain path separators or ".."', errorCode: 2 }
    }
    return { result: true }
  },

  async call(input: SkillInput, context: ToolUseContext) {
    const cwd = context.getCwd()
    const skillName = input.skill_name.trim()

    const skillPath = findSkillFile(cwd, skillName)

    if (!skillPath) {
      const skillsDir = join(cwd, '.kite', 'skills')
      return {
        data: {
          skill_name: skillName,
          content: [
            `Skill "${skillName}" not found.`,
            '',
            `Looked in:`,
            `  - ${join(skillsDir, skillName, 'SKILL.md')}`,
            `  - ${join(skillsDir, skillName, 'skill.md')}`,
            `  - ${join(skillsDir, `${skillName}.md`)}`,
            '',
            'To create this skill, create one of the above files with markdown content.',
          ].join('\n'),
          arguments: input.arguments,
          found: false,
        } as SkillOutput,
      }
    }

    try {
      let content = readFileSync(skillPath, 'utf-8')

      // Interpolate arguments if provided
      if (input.arguments && Object.keys(input.arguments).length > 0) {
        content = interpolateArguments(content, input.arguments)
      }

      return {
        data: {
          skill_name: skillName,
          content,
          arguments: input.arguments,
          found: true,
        } as SkillOutput,
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      return {
        data: {
          skill_name: skillName,
          content: `Error reading skill "${skillName}": ${e.message || 'Unknown error'}`,
          arguments: input.arguments,
          found: false,
        } as SkillOutput,
      }
    }
  },

  mapToolResultToToolResultBlockParam(content: SkillOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: content.content,
      is_error: !content.found,
    }
  },
})

export { SKILL_TOOL_NAME }
