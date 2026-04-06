/**
 * TeamCreateTool — Create a multi-agent swarm team.
 *
 * Based on Claude Code's TeamCreateTool.ts.
 * Initializes a team directory structure, assigns the current session as
 * team lead, creates a shared task list, and updates AppState.
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

// ============================================================================
// Constants
// ============================================================================

export const TEAM_CREATE_TOOL_NAME = 'TeamCreate'
const TEAMS_DIR = join(homedir(), '.kite', 'teams')
const TASKS_DIR = join(homedir(), '.kite', 'tasks')

// ============================================================================
// Types
// ============================================================================

export interface TeamMember {
  agentId: string
  name: string
  agentType: string
  model: string
  joinedAt: number
  cwd: string
  isActive: boolean
}

export interface TeamFile {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  members: TeamMember[]
}

interface TeamCreateOutput {
  team_name: string
  team_file_path: string
  lead_agent_id: string
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function generateWordSlug(): string {
  const adjectives = ['swift', 'bright', 'calm', 'bold', 'keen', 'sharp', 'quick', 'warm']
  const nouns = ['hawk', 'wolf', 'bear', 'lion', 'fox', 'owl', 'elk', 'ram']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!
  return `${adj}-${noun}-${randomUUID().slice(0, 4)}`
}

function getTeamFilePath(teamName: string): string {
  return join(TEAMS_DIR, sanitizeName(teamName), 'team.json')
}

export function readTeamFile(teamName: string): TeamFile | null {
  const path = getTeamFilePath(teamName)
  if (!existsSync(path)) return null
  try {
    const { readFileSync } = require('fs')
    return JSON.parse(readFileSync(path, 'utf-8')) as TeamFile
  } catch {
    return null
  }
}

function writeTeamFile(teamName: string, data: TeamFile): string {
  const dir = join(TEAMS_DIR, sanitizeName(teamName))
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'team.json')
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  return path
}

function ensureTasksDir(taskListId: string): void {
  const dir = join(TASKS_DIR, taskListId)
  mkdirSync(dir, { recursive: true })
}

// ============================================================================
// Teammate colors
// ============================================================================

const TEAMMATE_COLORS = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red']
let colorIndex = 0

function assignTeammateColor(): string {
  const color = TEAMMATE_COLORS[colorIndex % TEAMMATE_COLORS.length]!
  colorIndex++
  return color
}

export function clearTeammateColors(): void {
  colorIndex = 0
}

// ============================================================================
// Schema
// ============================================================================

const inputSchema = z.object({
  team_name: z.preprocess(
    (val) => (!val || val === 'null') ? `team-${randomUUID().slice(0, 6)}` : String(val),
    z.string().describe('Name for the new team'),
  ),
  description: z.preprocess(
    (val) => val === null || val === 'null' ? undefined : val,
    z.string().optional().describe('Optional description of the team purpose'),
  ),
  agent_type: z.preprocess(
    (val) => val === null || val === 'null' ? undefined : val,
    z.string().optional().describe('Role of the team lead (e.g., "researcher", "developer")'),
  ),
}).passthrough()

type TeamCreateInput = z.infer<typeof inputSchema>

// ============================================================================
// Tool
// ============================================================================

export const TeamCreateTool = buildTool({
  name: TEAM_CREATE_TOOL_NAME,
  searchHint: 'create a multi-agent swarm team for coordinated work',
  maxResultSizeChars: 5_000,
  strict: false,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => false,

  async description(input: TeamCreateInput) {
    return `Create team: ${input.team_name}`
  },

  async prompt() {
    return `Create a multi-agent swarm team for coordinated parallel work. The team has a lead agent (you) and can spawn teammate agents. Each team gets a shared task list for coordination.

Parameters:
- team_name: Name for the team (e.g., "refactor-team", "research-squad")
- description: Optional purpose description
- agent_type: Optional role for the team lead (e.g., "coordinator", "researcher")`
  },

  async call(input: TeamCreateInput, context: ToolUseContext) {
    const { team_name, description, agent_type } = input

    // Check if already in a team
    const appState = (context as any).getAppState?.() ?? {}
    if (appState.teamContext) {
      return {
        data: {
          team_name: appState.teamContext.teamName,
          team_file_path: '',
          lead_agent_id: appState.teamContext.leadAgentId,
          error: `Already in team "${appState.teamContext.teamName}". Use TeamDelete to disband first.`,
        },
      }
    }

    // Generate unique name if collision
    let finalName = team_name
    if (readTeamFile(team_name)) {
      finalName = generateWordSlug()
    }

    const leadAgentId = `team-lead-${sanitizeName(finalName)}`
    const taskListId = sanitizeName(finalName)
    const model = context.options?.mainLoopModel ?? 'unknown'

    // Create team file
    const teamData: TeamFile = {
      name: finalName,
      description,
      createdAt: Date.now(),
      leadAgentId,
      members: [{
        agentId: leadAgentId,
        name: 'team-lead',
        agentType: agent_type ?? 'coordinator',
        model,
        joinedAt: Date.now(),
        cwd: process.cwd(),
        isActive: true,
      }],
    }

    const teamFilePath = writeTeamFile(finalName, teamData)

    // Initialize task list directory
    ensureTasksDir(taskListId)

    // Update AppState
    const setAppState = (context as any).setAppState
    if (setAppState) {
      setAppState((prev: any) => ({
        ...prev,
        teamContext: {
          teamName: finalName,
          teamFilePath,
          leadAgentId,
          taskListId,
          teammates: {
            [leadAgentId]: {
              name: 'team-lead',
              agentType: agent_type ?? 'coordinator',
              color: assignTeammateColor(),
              cwd: process.cwd(),
              spawnedAt: Date.now(),
            },
          },
        },
      }))
    }

    return {
      data: {
        team_name: finalName,
        team_file_path: teamFilePath,
        lead_agent_id: leadAgentId,
      } as TeamCreateOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: any, toolUseID: string) {
    if (data.error) {
      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseID,
        content: `<tool_use_error>${data.error}</tool_use_error>`,
        is_error: true,
      }
    }
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Team "${data.team_name}" created.\nLead agent: ${data.lead_agent_id}\nTeam file: ${data.team_file_path}\nUse Agent tool to spawn teammates.`,
    }
  },
})
