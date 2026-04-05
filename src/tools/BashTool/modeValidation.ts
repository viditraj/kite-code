/**
 * Permission mode validation for bash commands.
 *
 * In acceptEdits mode, certain filesystem-modifying commands (mkdir, touch, rm, etc.)
 * are automatically allowed without prompting the user. This module implements
 * the logic to detect those commands and produce the appropriate PermissionResult.
 */

import type { PermissionResult } from '../../Tool.js'
import type { ToolPermissionContext } from '../../types/permissions.js'

// ============================================================================
// Constants
// ============================================================================

const ACCEPT_EDITS_ALLOWED_COMMANDS = [
  'mkdir',
  'touch',
  'rm',
  'rmdir',
  'mv',
  'cp',
  'sed',
] as const

// ============================================================================
// Helpers
// ============================================================================

/**
 * Type guard: returns true if the base command (first word) is one of the
 * filesystem commands that acceptEdits mode auto-allows.
 */
function isFilesystemCommand(command: string): boolean {
  const baseCommand = command.trim().split(/\s+/)[0] ?? ''
  return (ACCEPT_EDITS_ALLOWED_COMMANDS as readonly string[]).includes(
    baseCommand,
  )
}

// ============================================================================
// Core validation
// ============================================================================

/**
 * Validate a single (sub)command against the current permission mode.
 *
 * - In acceptEdits mode, filesystem commands are auto-allowed.
 * - All other cases fall through to the next permission check.
 */
function validateCommandForMode(
  cmd: string,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const trimmed = cmd.trim()
  const baseCommand = trimmed.split(/\s+/)[0] ?? ''

  if (
    toolPermissionContext.mode === 'acceptEdits' &&
    isFilesystemCommand(trimmed)
  ) {
    return {
      behavior: 'allow',
      updatedInput: { command: cmd },
    }
  }

  return {
    behavior: 'passthrough',
    message: `Command "${baseCommand}" is not auto-allowed in ${toolPermissionContext.mode} mode`,
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Main entry point: check whether the full command (potentially compound)
 * can be auto-allowed based on the current permission mode.
 *
 * - bypassPermissions and dontAsk modes are handled elsewhere, so we return
 *   passthrough immediately for those.
 * - The command is split on `&&`, `||`, and `;` into subcommands.
 * - If ANY subcommand is auto-allowed, we return that allow result.
 * - Otherwise we return passthrough so downstream checks can decide.
 */
function checkPermissionMode(
  input: { command: string },
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const { mode } = toolPermissionContext

  // bypassPermissions and dontAsk are handled by other layers
  if (mode === 'bypassPermissions' || mode === 'dontAsk') {
    return {
      behavior: 'passthrough',
      message: `${mode} mode is handled elsewhere`,
    }
  }

  // Split compound commands on &&, ||, ;
  const subcommands = input.command
    .split(/&&|\|\||;/)
    .map(s => s.trim())
    .filter(Boolean)

  for (const sub of subcommands) {
    const result = validateCommandForMode(sub, toolPermissionContext)
    if (result.behavior === 'allow') {
      return result
    }
  }

  return {
    behavior: 'passthrough',
    message: 'No subcommand matched an auto-allowed command for the current mode',
  }
}

/**
 * Return the list of commands that are automatically allowed in the given mode.
 */
function getAutoAllowedCommands(
  mode: ToolPermissionContext['mode'],
): readonly string[] {
  if (mode === 'acceptEdits') {
    return ACCEPT_EDITS_ALLOWED_COMMANDS
  }
  return []
}

// ============================================================================
// Exports
// ============================================================================

export { checkPermissionMode, getAutoAllowedCommands, ACCEPT_EDITS_ALLOWED_COMMANDS }
