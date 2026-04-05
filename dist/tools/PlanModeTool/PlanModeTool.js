/**
 * PlanModeTool — Enter and exit plan mode for complex tasks.
 *
 * Provides two tools:
 * - EnterPlanMode: Switch to plan mode to explore and design before coding
 * - ExitPlanMode: Present plan for approval and return to previous mode
 *
 * Plan mode allows the agent to explore the codebase, understand architecture,
 * and design an approach without making changes. The user approves the plan
 * before implementation begins.
 */
import { z } from 'zod';
import { buildTool } from '../../Tool.js';
export const ENTER_PLAN_MODE_TOOL_NAME = 'EnterPlanMode';
export const EXIT_PLAN_MODE_TOOL_NAME = 'ExitPlanMode';
// ============================================================================
// EnterPlanMode Tool
// ============================================================================
const enterPlanModeInputSchema = z.strictObject({});
export const EnterPlanModeTool = buildTool({
    name: ENTER_PLAN_MODE_TOOL_NAME,
    searchHint: 'switch to plan mode to design an approach before coding',
    maxResultSizeChars: 100_000,
    shouldDefer: true,
    inputSchema: enterPlanModeInputSchema,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    async description() {
        return 'Requests permission to enter plan mode for complex tasks requiring exploration and design';
    },
    async prompt() {
        return `Enter plan mode to explore the codebase and design an approach before making changes.

Use this tool when you encounter tasks that require careful planning before implementation.
Plan mode is appropriate for:

1. **New features** — When implementing something new that requires understanding the existing
   architecture, patterns, and conventions before writing code.

2. **Multiple possible approaches** — When there are several ways to solve a problem and you
   need to evaluate trade-offs before committing to an approach.

3. **Code modifications requiring understanding** — When you need to modify existing code but
   first need to understand how it works, what depends on it, and what the implications of
   changes might be.

4. **Architectural decisions** — When the task involves decisions about project structure,
   design patterns, or technology choices that will have lasting impact.

5. **Multi-file changes** — When changes span multiple files and you need to understand the
   relationships and dependencies between them before making modifications.

6. **Unclear requirements** — When the user's request is ambiguous or complex and you need
   to explore the codebase to determine the best interpretation and approach.

7. **User preferences matter** — When there are meaningful choices to present to the user
   and their input would improve the outcome.

In plan mode, you can freely read files, search the codebase, and analyze code without
making any modifications. Once you have a complete plan, use ExitPlanMode to present it
for user approval before proceeding with implementation.

Do NOT use plan mode for simple, straightforward tasks that you can implement directly.`;
    },
    async checkPermissions() {
        return { behavior: 'allow' };
    },
    userFacingName() {
        return ENTER_PLAN_MODE_TOOL_NAME;
    },
    toAutoClassifierInput() {
        return 'enter plan mode';
    },
    getToolUseSummary() {
        return 'Entering plan mode';
    },
    getActivityDescription() {
        return 'Entering plan mode';
    },
    async call(_args, context) {
        if (context.agentId) {
            throw new Error('EnterPlanMode cannot be called from an agent context. Only the main session can enter plan mode.');
        }
        const appState = context.getAppState();
        const currentMode = appState.mode ?? 'default';
        const prePlanMode = currentMode;
        context.setAppState((prev) => ({
            ...prev,
            mode: 'plan',
            prePlanMode,
        }));
        return {
            data: {
                message: 'Entered plan mode. You can now explore the codebase and design your approach without making changes.',
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: `${content.message}\n\nIn plan mode, you should:\n1. Thoroughly explore the codebase to understand the architecture\n2. Identify relevant files and dependencies\n3. Design your approach with clear steps\n4. Consider edge cases and potential issues\n5. Present your plan for user approval before making changes\n\nUse ExitPlanMode when your plan is ready for review.`,
        };
    },
});
// ============================================================================
// ExitPlanMode Tool
// ============================================================================
const exitPlanModeInputSchema = z.strictObject({});
export const ExitPlanModeTool = buildTool({
    name: EXIT_PLAN_MODE_TOOL_NAME,
    searchHint: 'present plan for approval and start coding (plan mode only)',
    maxResultSizeChars: 100_000,
    shouldDefer: true,
    inputSchema: exitPlanModeInputSchema,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    requiresUserInteraction() {
        return true;
    },
    async description() {
        return 'Exit plan mode and return to the previous permission mode';
    },
    async prompt() {
        return 'Exit plan mode. The user will be prompted to approve your plan before you can start making changes. Only use this when you have a complete plan ready for review.';
    },
    async checkPermissions() {
        return { behavior: 'allow' };
    },
    async validateInput(_input, context) {
        const appState = context.getAppState();
        const currentMode = appState.mode ?? 'default';
        if (currentMode !== 'plan') {
            return { result: false, message: 'Not currently in plan mode.' };
        }
        return { result: true };
    },
    userFacingName() {
        return EXIT_PLAN_MODE_TOOL_NAME;
    },
    toAutoClassifierInput() {
        return 'exit plan mode';
    },
    getToolUseSummary() {
        return 'Exiting plan mode';
    },
    getActivityDescription() {
        return 'Exiting plan mode';
    },
    async call(_args, context) {
        const appState = context.getAppState();
        const prePlanMode = appState.prePlanMode ?? 'default';
        context.setAppState((prev) => ({
            ...prev,
            mode: prePlanMode,
            prePlanMode: undefined,
        }));
        return {
            data: {
                message: 'Exited plan mode. You can now proceed with implementation.',
                previousMode: prePlanMode,
            },
        };
    },
    mapToolResultToToolResultBlockParam(_content, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: `User has approved exiting plan mode. You can now proceed with implementation.\n\nRemember to:\n- Follow your plan step by step\n- Use the todo list to track progress\n- Verify each step before moving to the next`,
        };
    },
});
//# sourceMappingURL=PlanModeTool.js.map