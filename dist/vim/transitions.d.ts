/**
 * Vim state transition table.
 *
 * Implements the same transition logic as Claude Code's vim/transitions.ts:
 * - Each state has a dedicated transition function
 * - Returns { next, execute } — next state and optional side effect
 * - Main dispatch based on CommandState.type
 */
import { type OperatorContext } from './operators.js';
import { type CommandState } from './types.js';
export type TransitionContext = OperatorContext & {
    onUndo?: () => void;
    onDotRepeat?: () => void;
};
export type TransitionResult = {
    next?: CommandState;
    execute?: () => void;
};
export declare function transition(state: CommandState, input: string, ctx: TransitionContext): TransitionResult;
//# sourceMappingURL=transitions.d.ts.map