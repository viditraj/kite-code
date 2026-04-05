/**
 * VerifyPlanTool — Verify that plan steps have been executed.
 *
 * Checks plan steps against the conversation history and appState
 * to determine which steps are completed, in progress, or pending.
 * Auto-allowed (no permission prompt needed).
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'

const VERIFY_PLAN_TOOL_NAME = 'VerifyPlan'

const inputSchema = z.strictObject({
  plan_steps: z.array(z.string()).describe('Array of plan step descriptions to verify'),
})

type VerifyPlanInput = z.infer<typeof inputSchema>

interface StepVerification {
  step: string
  status: 'verified' | 'not_found' | 'partial'
  evidence: string
}

interface VerifyPlanOutput {
  steps: StepVerification[]
  totalSteps: number
  verifiedCount: number
  notFoundCount: number
  partialCount: number
  allVerified: boolean
  message: string
}

function extractMessageTexts(messages: ReadonlyArray<unknown>): string[] {
  const texts: string[] = []
  for (const msg of messages) {
    if (msg && typeof msg === 'object') {
      const m = msg as Record<string, unknown>
      if (typeof m.content === 'string') {
        texts.push(m.content.toLowerCase())
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block && typeof block === 'object') {
            const b = block as Record<string, unknown>
            if (typeof b.text === 'string') {
              texts.push(b.text.toLowerCase())
            }
            if (typeof b.content === 'string') {
              texts.push(b.content.toLowerCase())
            }
          }
        }
      }
    }
  }
  return texts
}

function extractTodoContents(appState: Record<string, unknown>): string[] {
  const contents: string[] = []
  const todos = appState.todos
  if (todos && typeof todos === 'object' && !Array.isArray(todos)) {
    for (const todoList of Object.values(todos as Record<string, unknown>)) {
      if (Array.isArray(todoList)) {
        for (const item of todoList) {
          if (item && typeof item === 'object') {
            const t = item as Record<string, unknown>
            if (typeof t.content === 'string' && t.status === 'completed') {
              contents.push(t.content.toLowerCase())
            }
          }
        }
      }
    }
  }
  return contents
}

function verifyStep(
  step: string,
  messageTexts: string[],
  completedTodos: string[],
): StepVerification {
  const stepLower = step.toLowerCase()
  // Extract keywords from the step (words longer than 3 chars)
  const keywords = stepLower
    .split(/\s+/)
    .filter(w => w.length > 3)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)

  if (keywords.length === 0) {
    return {
      step,
      status: 'not_found',
      evidence: 'Step description too vague to verify',
    }
  }

  // Check completed todos first (strongest signal)
  for (const todo of completedTodos) {
    const matchCount = keywords.filter(kw => todo.includes(kw)).length
    if (matchCount >= keywords.length * 0.7) {
      return {
        step,
        status: 'verified',
        evidence: `Matched completed todo: "${todo}"`,
      }
    }
  }

  // Check conversation messages
  let bestMatchCount = 0
  let bestMatchText = ''
  for (const text of messageTexts) {
    const matchCount = keywords.filter(kw => text.includes(kw)).length
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount
      bestMatchText = text.slice(0, 100)
    }
  }

  const matchRatio = keywords.length > 0 ? bestMatchCount / keywords.length : 0

  if (matchRatio >= 0.7) {
    return {
      step,
      status: 'verified',
      evidence: `Found in conversation (${Math.round(matchRatio * 100)}% keyword match): "${bestMatchText}..."`,
    }
  } else if (matchRatio >= 0.3) {
    return {
      step,
      status: 'partial',
      evidence: `Partial match in conversation (${Math.round(matchRatio * 100)}% keyword match): "${bestMatchText}..."`,
    }
  }

  return {
    step,
    status: 'not_found',
    evidence: 'No matching evidence found in conversation or completed todos',
  }
}

export const VerifyPlanTool = buildTool({
  name: VERIFY_PLAN_TOOL_NAME,
  searchHint: 'verify plan steps execution progress check',
  maxResultSizeChars: 50_000,
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
    return 'Verify that plan steps have been executed'
  },

  async prompt() {
    return `Verify that plan steps have been executed by checking the conversation history and session state.

Input:
- plan_steps: Array of step descriptions to verify (e.g., ["Create database schema", "Write API endpoints", "Add tests"])

Each step is checked against:
1. Completed todo items in the session state
2. Conversation message history (keyword matching)

Returns the verification status for each step:
- "verified": Step appears to have been completed
- "partial": Some evidence found but not conclusive
- "not_found": No evidence of completion found

Use this to validate that a plan was fully executed before reporting completion.`
  },

  async checkPermissions(input: Record<string, unknown>) {
    return { behavior: 'allow' as const, updatedInput: input }
  },

  userFacingName() {
    return 'VerifyPlan'
  },

  toAutoClassifierInput(input: VerifyPlanInput) {
    return `verify plan ${input.plan_steps.length} steps`
  },

  getToolUseSummary(input?: Partial<VerifyPlanInput>) {
    const steps = input?.plan_steps
    if (!steps || !Array.isArray(steps)) return null
    return `Verifying ${steps.length} plan step(s)`
  },

  getActivityDescription(input?: Partial<VerifyPlanInput>) {
    const steps = input?.plan_steps
    if (!steps || !Array.isArray(steps)) return 'Verifying plan'
    return `Verifying ${steps.length} plan step(s)`
  },

  async validateInput(input: VerifyPlanInput) {
    if (!input.plan_steps || !Array.isArray(input.plan_steps) || input.plan_steps.length === 0) {
      return { result: false, message: 'plan_steps must be a non-empty array of strings', errorCode: 1 }
    }
    for (let i = 0; i < input.plan_steps.length; i++) {
      if (typeof input.plan_steps[i] !== 'string' || !input.plan_steps[i]!.trim()) {
        return { result: false, message: `Step ${i + 1} must be a non-empty string`, errorCode: 2 }
      }
    }
    return { result: true }
  },

  async call(input: VerifyPlanInput, context: ToolUseContext) {
    const messageTexts = extractMessageTexts(context.messages)
    const appState = context.getAppState()
    const completedTodos = extractTodoContents(appState)

    const steps: StepVerification[] = input.plan_steps.map(step =>
      verifyStep(step, messageTexts, completedTodos)
    )

    const verifiedCount = steps.filter(s => s.status === 'verified').length
    const notFoundCount = steps.filter(s => s.status === 'not_found').length
    const partialCount = steps.filter(s => s.status === 'partial').length
    const totalSteps = steps.length
    const allVerified = verifiedCount === totalSteps

    let message: string
    if (allVerified) {
      message = `All ${totalSteps} plan steps verified successfully.`
    } else {
      message = `Plan verification: ${verifiedCount}/${totalSteps} verified, ${partialCount} partial, ${notFoundCount} not found.`
    }

    return {
      data: {
        steps,
        totalSteps,
        verifiedCount,
        notFoundCount,
        partialCount,
        allVerified,
        message,
      } as VerifyPlanOutput,
    }
  },

  mapToolResultToToolResultBlockParam(content: VerifyPlanOutput, toolUseID: string) {
    const STATUS_ICONS: Record<string, string> = {
      verified: '\u2713',
      partial: '\u25CB',
      not_found: '\u2717',
    }

    const lines = [content.message, '']
    for (let i = 0; i < content.steps.length; i++) {
      const step = content.steps[i]!
      const icon = STATUS_ICONS[step.status] || '?'
      lines.push(`${i + 1}. [${icon}] ${step.step}`)
      lines.push(`   Status: ${step.status}`)
      lines.push(`   Evidence: ${step.evidence}`)
      lines.push('')
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: lines.join('\n').trim(),
    }
  },
})

export { VERIFY_PLAN_TOOL_NAME }
