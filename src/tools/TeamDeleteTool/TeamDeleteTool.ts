/**
 * TeamDeleteTool — Disband a swarm team and clean up state.
 *
 * Based on Claude Code's TeamDeleteTool.ts.
 * Validates that all teammates have stopped, removes team directories
 * and task lists, and resets AppState.
 */

import { z } from 'zod'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import { readTeamFile, clearTeammateColors } from '../TeamCreateTool/TeamCreateTool.js'

// ============================================================================
// Constants
// ============================================================================

export const TEAM_DELETE_TOOL_NAME = 'TeamDelete'
const TEAMS_DIR = join(homedir(), '.kite', 'teams')
const TASKS_DIR = join(homedir(), '.kite', 'tasks')

// ============================================================================
// Types
// ============================================================================

interface TeamDeleteOutput {
  success: boolean
  message: string
  team_name?: string
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function cleanupTeamDirectories(teamName: string): void {
  const sanitized = sanitizeName(teamName)

  // Remove team directory
  const teamDir = join(TEAMS_DIR, sanitized)
  if (existsSync(teamDir)) {
    try {
      rmSync(teamDir, { recursive: true })
    } catch {
      // Non-fatal
    }
  }

  // Remove task directory
  const taskDir = join(TASKS_DIR, sanitized)
  if (existsSync(taskDir)) {
    try {
      rmSync(taskDir, { recursive: true })
    } catch {
      // Non-fatal
    }
  }
}

// ============================================================================
// Schema
// ============================================================================

const inputSchema = z.object({}).passthrough()

// ============================================================================
// Tool
// ============================================================================

export const TeamDeleteTool = buildTool({
  name: TEAM_DELETE_TOOL_NAME,
  searchHint: 'disband a multi-agent swarm team',
  maxResultSizeChars: 5_000,
  strict: false,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => false,

  async description() {
    return 'Disband the current team'
  },

  async prompt() {
    return `Disband the current multi-agent swarm team and clean up all associated state. All teammates must be stopped before the team can be deleted.`
  },

  async call(_input: Record<string, unknown>, context: ToolUseContext) {
    const appState = (context as any).getAppState?.() ?? {}
    const teamContext = appState.teamContext

    if (!teamContext || !teamContext.teamName) {
      return {
        data: {
          success: false,
          message: 'Not currently in a team. Nothing to delete.',
        } as TeamDeleteOutput,
      }
    }

    const teamName = teamContext.teamName
    const teamFile = readTeamFile(teamName)

    // Validate: check for active members (excluding team lead)
    if (teamFile) {
      const activeMembers = teamFile.members.filter(
        m => m.name !== 'team-lead' && m.isActive !== false,
      )

      if (activeMembers.length > 0) {
        return {
          data: {
            success: false,
            message: `Cannot delete team "${teamName}" with ${activeMembers.length} active teammate(s): ${activeMembers.map(m => m.name).join(', ')}. Stop all teammates first.`,
            team_name: teamName,
          } as TeamDeleteOutput,
        }
      }
    }

    // Cleanup
    cleanupTeamDirectories(teamName)
    clearTeammateColors()

    // Reset AppState
    const setAppState = (context as any).setAppState
    if (setAppState) {
      setAppState((prev: any) => ({
        ...prev,
        teamContext: undefined,
      }))
    }

    return {
      data: {
        success: true,
        message: `Team "${teamName}" has been disbanded. All team files and task lists have been cleaned up.`,
        team_name: teamName,
      } as TeamDeleteOutput,
    }
  },

  mapToolResultToToolResultBlockParam(data: TeamDeleteOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: data.message,
      is_error: !data.success,
    }
  },
})
