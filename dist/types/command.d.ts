/**
 * Command type definitions.
 *
 * Implements the same type system as Claude Code's types/command.ts:
 * - CommandBase: common fields (name, description, aliases, isEnabled, isHidden)
 * - PromptCommand: injects text into conversation (skills, MCP prompts)
 * - LocalCommand: executes locally, returns text result
 * - LocalJSXCommand: renders JSX UI (model picker, config editor, etc.)
 * - Command: discriminated union of all three
 */
import type { ToolUseContext } from '../Tool.js';
import type { ContentBlock, UnifiedMessage } from '../providers/types.js';
export type LocalCommandResult = {
    type: 'text';
    value: string;
} | {
    type: 'compact';
    displayText?: string;
} | {
    type: 'skip';
};
export type CommandResultDisplay = 'skip' | 'system' | 'user';
export interface LocalCommandContext extends ToolUseContext {
    setMessages: (updater: (prev: UnifiedMessage[]) => UnifiedMessage[]) => void;
}
/**
 * Callback when a command completes.
 */
export type LocalCommandOnDone = (result?: string, options?: {
    display?: CommandResultDisplay;
    shouldQuery?: boolean;
    metaMessages?: string[];
    nextInput?: string;
    submitNextInput?: boolean;
}) => void;
export type LocalCommandCall = (args: string, context: LocalCommandContext) => Promise<LocalCommandResult>;
export type LocalCommandModule = {
    call: LocalCommandCall;
};
export type PromptCommand = {
    type: 'prompt';
    progressMessage: string;
    contentLength: number;
    argNames?: string[];
    allowedTools?: string[];
    model?: string;
    source: 'builtin' | 'mcp' | 'plugin' | 'bundled' | 'user' | 'project' | 'local';
    /** Execution context: 'inline' (default) or 'fork' (run as sub-agent) */
    context?: 'inline' | 'fork';
    /** Agent type when forked */
    agent?: string;
    /** Glob patterns for file paths this skill applies to */
    paths?: string[];
    /** Whether to disable model invocation */
    disableModelInvocation?: boolean;
    /** Whether users can invoke this skill by typing /skill-name */
    userInvocable?: boolean;
    getPromptForCommand(args: string, context: ToolUseContext): Promise<ContentBlock[]>;
};
export type LocalCommand = {
    type: 'local';
    supportsNonInteractive: boolean;
    call: LocalCommandCall;
};
export type LocalJSXCommand = {
    type: 'local-jsx';
    call: (onDone: LocalCommandOnDone, context: LocalCommandContext, args: string) => Promise<string | null>;
};
export type CommandBase = {
    name: string;
    description: string;
    aliases?: string[];
    /** Defaults to true. Only set when the command has conditional enablement. */
    isEnabled?: () => boolean;
    /** Defaults to false. Only set when the command should be hidden from help. */
    isHidden?: boolean;
    /** Hint text for command arguments */
    argumentHint?: string;
    /** Detailed usage scenarios */
    whenToUse?: string;
    /** Whether command executes immediately without waiting for a stop point */
    immediate?: boolean;
    /** If true, args are redacted from conversation history */
    isSensitive?: boolean;
    /** Whether this is an MCP command */
    isMcp?: boolean;
    /** User-facing name override */
    userFacingName?: () => string;
    /** Where the command was loaded from */
    loadedFrom?: 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp';
};
export type Command = CommandBase & (PromptCommand | LocalCommand | LocalJSXCommand);
/** Resolves the user-visible name, falling back to cmd.name. */
export declare function getCommandName(cmd: CommandBase): string;
/** Resolves whether the command is enabled, defaulting to true. */
export declare function isCommandEnabled(cmd: CommandBase): boolean;
//# sourceMappingURL=command.d.ts.map