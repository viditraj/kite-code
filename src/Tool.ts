/**
 * Core Tool interface and buildTool factory.
 *
 * Implements the same patterns as Claude Code's Tool.ts:
 * - Tool type with all methods and properties
 * - buildTool() factory with fail-closed TOOL_DEFAULTS
 * - ToolDef type for partial definitions
 * - Zod-based input schemas
 *
 * Key design: buildTool() spreads TOOL_DEFAULTS first, then the definition.
 * This ensures fail-closed behavior: isConcurrencySafe defaults to false,
 * isReadOnly defaults to false, etc.
 */

import { z } from 'zod'
import type { ContentBlock } from './providers/types.js'

// ============================================================================
// Supporting Types
// ============================================================================

export type ToolInputJSONSchema = {
  [x: string]: unknown
  type: 'object'
  properties?: Record<string, unknown>
}

export interface ValidationResult {
  result: boolean
  message?: string
  errorCode?: number
}

export interface PermissionResult {
  behavior: 'allow' | 'deny' | 'ask' | 'passthrough'
  updatedInput?: Record<string, unknown>
  message?: string
}

export interface ToolResult<T = unknown> {
  data: T
  /** Additional messages to inject into the conversation */
  newMessages?: Array<{ role: string; content: string | ContentBlock[] }>
}

export type ToolCallProgress<P = unknown> = (progress: {
  toolUseID: string
  data: P
}) => void

/**
 * Tool use context — the environment tools execute in.
 *
 * Ported from Claude Code's ToolUseContext in Tool.ts lines 158-300.
 * Expanded with the critical properties tools need for execution,
 * permission checks, and state management.
 */
export interface ToolUseContext {
  abortController: AbortController
  options: {
    tools: ReadonlyArray<Tool>
    commands: ReadonlyArray<unknown>
    debug: boolean
    verbose: boolean
    mainLoopModel: string
    isNonInteractiveSession: boolean
    /** Refresh tools (e.g., after MCP servers connect mid-query) */
    refreshTools?: () => ReadonlyArray<Tool>
  }
  messages: ReadonlyArray<unknown>

  /** Get current working directory */
  getCwd(): string

  /** Get the global application state */
  getAppState(): Record<string, unknown>

  /** Update the global application state */
  setAppState(f: (prev: Record<string, unknown>) => Record<string, unknown>): void

  /** File state cache — tracks which files have been read (for Edit validation) */
  readFileState: {
    has(path: string): boolean
    get(path: string): unknown
    set(path: string, value: unknown): void
  }

  /** Track in-progress tool use IDs */
  setInProgressToolUseIDs(f: (prev: Set<string>) => Set<string>): void

  /** Track response length for token estimation */
  setResponseLength(f: (prev: number) => number): void

  /** Request interactive prompt from user (for permissions) */
  requestPrompt?: (
    sourceName: string,
    toolInputSummary?: string | null,
  ) => (request: { message: string }) => Promise<{ response: string }>

  /** File reading size limits */
  fileReadingLimits?: {
    maxTokens?: number
    maxSizeBytes?: number
  }

  /** Glob result limits */
  globLimits?: {
    maxResults?: number
  }

  /** Tool approval decisions cache */
  toolDecisions?: Map<string, {
    source: string
    decision: 'accept' | 'reject'
    timestamp: number
  }>

  /** User modified flag (set when user edits tool input) */
  userModified?: boolean

  /** Agent ID (for subagents) */
  agentId?: string

  /** Tool use ID (current) */
  toolUseId?: string
}

/** Minimal function to check if a tool can be used (permission checks) */
export type CanUseToolFn = (
  tool: Tool,
  input: Record<string, unknown>,
  context: ToolUseContext,
  assistantMessage: unknown,
  toolUseID: string,
) => Promise<PermissionResult>

// ============================================================================
// AnyObject — Zod type constraint for tool inputs
// ============================================================================

type AnyObject = z.ZodType<Record<string, unknown>>

// ============================================================================
// Tool Type — the full interface every tool implements
// ============================================================================

export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
> = {
  readonly name: string
  readonly aliases?: string[]
  readonly searchHint?: string
  readonly maxResultSizeChars: number
  readonly strict?: boolean
  readonly shouldDefer?: boolean
  readonly alwaysLoad?: boolean
  readonly isMcp?: boolean
  readonly isLsp?: boolean
  readonly mcpInfo?: { serverName: string; toolName: string }

  readonly inputSchema: Input
  readonly inputJSONSchema?: ToolInputJSONSchema
  readonly outputSchema?: z.ZodType<unknown>

  /** Execute the tool */
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: unknown,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<Output>>

  /** Tool description sent to the LLM */
  description(
    input: z.infer<Input>,
    options: { isNonInteractiveSession: boolean; tools: ReadonlyArray<Tool> },
  ): Promise<string>

  /** Full prompt for this tool */
  prompt(options: {
    tools: ReadonlyArray<Tool>
    getToolPermissionContext?: () => Promise<Record<string, unknown>>
    agents?: ReadonlyArray<unknown>
    allowedAgentTypes?: string[]
  }): Promise<string>

  // Safety flags (fail-closed defaults via buildTool)
  isEnabled(): boolean
  isConcurrencySafe(input: z.infer<Input>): boolean
  isReadOnly(input: z.infer<Input>): boolean
  isDestructive?(input: z.infer<Input>): boolean
  interruptBehavior?(): 'cancel' | 'block'
  requiresUserInteraction?(): boolean

  // Permissions
  validateInput?(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<ValidationResult>
  checkPermissions(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<PermissionResult>
  preparePermissionMatcher?(
    input: z.infer<Input>,
  ): Promise<(pattern: string) => boolean>

  // Metadata
  userFacingName(input: Partial<z.infer<Input>> | undefined): string
  getToolUseSummary?(input: Partial<z.infer<Input>> | undefined): string | null
  getActivityDescription?(input: Partial<z.infer<Input>> | undefined): string | null
  getPath?(input: z.infer<Input>): string
  toAutoClassifierInput(input: z.infer<Input>): unknown

  // Input mutation and permission matching
  /** Mutate input in place before observers see it (hooks, SDK stream, transcript) */
  backfillObservableInput?(input: Record<string, unknown>): void
  /** Check if two inputs are functionally equivalent */
  inputsEquivalent?(a: z.infer<Input>, b: z.infer<Input>): boolean
  /** Whether this tool operates on user-provided open-world data */
  isOpenWorld?(input: z.infer<Input>): boolean
  /** Transparent wrappers delegate all rendering to inner tools */
  isTransparentWrapper?(): boolean

  // Search/classification
  isSearchOrReadCommand?(input: z.infer<Input>): { isSearch: boolean; isRead: boolean; isList?: boolean }

  /** Map tool output to the API content block format */
  mapToolResultToToolResultBlockParam(
    content: Output,
    toolUseID: string,
  ): { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[]; is_error?: boolean }
}

export type Tools = ReadonlyArray<Tool>

// ============================================================================
// ToolDef — what the user passes to buildTool
// ============================================================================

type DefaultableToolKeys =
  | 'isEnabled'
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'checkPermissions'
  | 'toAutoClassifierInput'
  | 'userFacingName'

export type ToolDef<
  Input extends AnyObject = AnyObject,
  Output = unknown,
> = Omit<Tool<Input, Output>, DefaultableToolKeys> &
  Partial<Pick<Tool<Input, Output>, DefaultableToolKeys>>

// ============================================================================
// TOOL_DEFAULTS — fail-closed
// ============================================================================

const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?: unknown) => false,
  isReadOnly: (_input?: unknown) => false,
  isDestructive: (_input?: unknown) => false,
  checkPermissions: (
    input: Record<string, unknown>,
    _ctx?: ToolUseContext,
  ): Promise<PermissionResult> =>
    Promise.resolve({ behavior: 'passthrough' as const, message: '', updatedInput: input }),
  toAutoClassifierInput: (_input?: unknown) => '',
  userFacingName: (_input?: unknown) => '',
}

// ============================================================================
// buildTool — factory that merges defaults
// ============================================================================

/**
 * Build a complete Tool from a partial definition, filling in safe defaults.
 *
 * Defaults (fail-closed where it matters):
 * - isEnabled → true
 * - isConcurrencySafe → false (assume not safe)
 * - isReadOnly → false (assume writes)
 * - isDestructive → false
 * - checkPermissions → passthrough (defer to general permission system)
 * - toAutoClassifierInput → '' (skip classifier)
 * - userFacingName → name
 */
export function buildTool<D extends ToolDef<any, any>>(def: D): Tool {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as unknown as Tool
}

// ============================================================================
// Utility functions
// ============================================================================

/** Check if a tool matches the given name (primary name or alias) */
export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string,
): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false)
}

/** Find a tool by name or alias from a list of tools */
export function findToolByName(tools: Tools, name: string): Tool | undefined {
  return tools.find(t => toolMatchesName(t, name))
}
