/**
 * SleepTool — Delay execution for a given number of milliseconds.
 *
 * Simple async delay tool with a maximum duration of 5 minutes.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'

const SLEEP_TOOL_NAME = 'Sleep'
const MAX_DURATION_MS = 300_000 // 5 minutes

const inputSchema = z.strictObject({
  duration_ms: z.number().min(0).max(MAX_DURATION_MS).describe(
    `Duration to sleep in milliseconds (max ${MAX_DURATION_MS}ms / 5 minutes)`
  ),
})

type SleepInput = z.infer<typeof inputSchema>

interface SleepOutput {
  slept_ms: number
  message: string
}

export const SleepTool = buildTool({
  name: SLEEP_TOOL_NAME,
  searchHint: 'delay execution pause wait sleep',
  maxResultSizeChars: 1_000,
  strict: true,
  shouldDefer: true,

  inputSchema,

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Pause execution for the specified number of milliseconds'
  },

  async prompt() {
    return `Delay execution for a specified number of milliseconds.

Use this tool when you need to wait before proceeding, for example:
- Waiting for a service to start up
- Adding a delay between retry attempts
- Allowing time for a file system operation to complete

Input: { duration_ms: number } — milliseconds to sleep (max 300000 = 5 minutes).`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'Sleep'
  },

  toAutoClassifierInput(input: SleepInput) {
    return `sleep ${input.duration_ms}ms`
  },

  getToolUseSummary(input?: Partial<SleepInput>) {
    if (input?.duration_ms === undefined) return null
    return `Sleeping ${input.duration_ms}ms`
  },

  getActivityDescription(input?: Partial<SleepInput>) {
    if (input?.duration_ms === undefined) return 'Sleeping'
    return `Sleeping for ${input.duration_ms}ms`
  },

  async validateInput(input: SleepInput) {
    if (input.duration_ms < 0) {
      return { result: false, message: 'Duration must be non-negative', errorCode: 1 }
    }
    if (input.duration_ms > MAX_DURATION_MS) {
      return { result: false, message: `Duration cannot exceed ${MAX_DURATION_MS}ms (5 minutes)`, errorCode: 2 }
    }
    return { result: true }
  },

  async call(input: SleepInput) {
    const ms = Math.min(Math.max(0, input.duration_ms), MAX_DURATION_MS)
    await new Promise<void>(resolve => setTimeout(resolve, ms))

    return {
      data: {
        slept_ms: ms,
        message: `Slept for ${ms}ms`,
      } as SleepOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: SleepOutput, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: content.message,
    }
  },
})

export { SLEEP_TOOL_NAME }
