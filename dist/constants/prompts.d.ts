/**
 * System prompt builder.
 *
 * Ported from: Claude Code's src/constants/prompts.ts.
 * Builds the multi-section system prompt that defines Kite's identity,
 * capabilities, tool usage guidelines, and behavioral constraints.
 *
 * Sections match the original:
 * 1. Intro (identity + safety)
 * 2. System (tool permissions, reminders)
 * 3. Doing tasks (software engineering guidance)
 * 4. Actions (reversibility, blast radius)
 * 5. Using your tools (dedicated tool preference)
 * 6. Tone and style
 * 7. Environment info (CWD, platform, model, date)
 */
/**
 * Build the full system prompt.
 *
 * Ported from: getSystemPrompt in prompts.ts.
 */
export declare function getSystemPrompt(model?: string, tools?: string[], cwd?: string): string;
//# sourceMappingURL=prompts.d.ts.map