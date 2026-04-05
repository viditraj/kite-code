/**
 * AskUserQuestionTool — Present multiple-choice questions to the user.
 *
 * Implements the same patterns as Claude Code's AskUserQuestionTool:
 * - Present 1-4 multiple-choice questions
 * - Each question has 2-4 options plus auto-added "Other"
 * - Supports single-select and multi-select
 * - Collects answers keyed by question text
 * - Always read-only, concurrency-safe, requires user interaction
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'
export const ASK_USER_QUESTION_TOOL_CHIP_WIDTH = 12

const questionOptionSchema = z.object({
  label: z.string().describe('Display text the user sees (1-5 words).'),
  description: z.string().describe('Explanation of what this option means or its trade-offs.'),
})

const questionSchema = z.object({
  question: z.string().describe('The full question text to display to the user.'),
  header: z.string().describe('Short label displayed as a chip/tag, e.g. "Auth method", "Library". Labels longer than 16 characters are truncated with an ellipsis for display.'),
  options: z.array(questionOptionSchema).min(2).max(4).describe('The choices presented to the user (2-4 options). An "Other" free-text option is always added automatically.'),
  multi_select: z.boolean().default(false).optional().describe('If true, the user can select multiple options; if false, single-select only.'),
})

const inputSchema = z.strictObject({
  questions: z.array(questionSchema).min(1).max(4).describe('Array of 1-4 question objects to present to the user.'),
  answers: z.record(z.string(), z.object({
    selected: z.array(z.string()).describe('The selected option label(s).'),
    custom_text: z.string().optional().describe('Custom text provided by the user.'),
  })).optional().describe("User's answers, keyed by question text. Populated by the UI when the user responds. Do not set this yourself."),
})

interface AskUserQuestionOutput {
  questions: z.infer<typeof questionSchema>[]
  answers: Record<string, { selected: string[]; custom_text?: string }>
}

export const AskUserQuestionTool = buildTool({
  name: ASK_USER_QUESTION_TOOL_NAME,
  searchHint: 'prompt the user with a multiple-choice question',
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

  requiresUserInteraction() {
    return true
  },

  async description() {
    return 'Present multiple-choice questions to the user and collect their answers.'
  },

  async prompt() {
    return `Present multiple-choice questions to the user and collect their answers.

Use this tool when you need the user to make a decision between several options, such as choosing
an implementation approach, selecting a library, or confirming a design choice.

Key constraints:
- 1-4 questions per call
- 2-4 options per question (an "Other" free-text option is always added automatically)
- Keep headers short (e.g. "Auth method", "Library"); headers over 16 characters are truncated
- Option labels should be 1-5 words

The user can:
- Select from the predefined options
- Type a custom answer via the "Other" option
- Select an option and add additional context
- Choose "Not ready to answer, help me out!" to reject and ask for clarification

If the user submits answers, you will receive a key-value mapping of question text to their selections.
If the user chooses to chat instead, you will receive a rejection with any partial answers they provided.`
  },

  async checkPermissions() {
    return { behavior: 'allow' as const }
  },

  userFacingName() {
    return ASK_USER_QUESTION_TOOL_NAME
  },

  async call(args: z.infer<typeof inputSchema>) {
    return {
      data: {
        questions: args.questions,
        answers: args.answers ?? {},
      },
    }
  },

  mapToolResultToToolResultBlockParam(data: AskUserQuestionOutput, toolUseID: string) {
    const answerEntries = Object.entries(data.answers)
    const formatted = answerEntries
      .map(([question, answer]) => {
        const selected = answer.selected.join(', ')
        let entry = `"${question}"="${selected}"`
        if (answer.custom_text) {
          entry += ` (${answer.custom_text})`
        }
        return entry
      })
      .join('\n')

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `User has answered your questions:\n${formatted}\nYou can now continue with the user's answers in mind.`,
    }
  },
})
