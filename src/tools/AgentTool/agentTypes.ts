/**
 * Agent type definitions and built-in agent registry.
 *
 * Based on Claude Code's AgentTool/builtInAgents.ts and built-in/*.ts.
 * Defines the interface for agent types and provides built-in agents:
 * - GeneralPurpose: full tool access, multi-step research
 * - Explore: read-only, fast codebase search (uses lighter model)
 * - Plan: read-only, architecture and implementation planning
 */

// ============================================================================
// Types
// ============================================================================

export interface AgentDefinition {
  /** Agent type identifier (e.g., 'general-purpose', 'Explore', 'Plan') */
  agentType: string
  /** When to use this agent (shown to model for selection) */
  whenToUse: string
  /** Tool names this agent can use. ['*'] means all tools. */
  tools: string[]
  /** Tool names explicitly disallowed for this agent */
  disallowedTools?: string[]
  /** Whether this agent should run in background by default */
  background?: boolean
  /** Source: 'built-in' or 'custom' */
  source: 'built-in' | 'custom'
  /** Model override: 'inherit' uses parent's model, 'haiku' uses cheaper model */
  model?: 'inherit' | 'haiku' | string
  /** Whether to omit AGENTS.md/CLAUDE.md from agent context (saves tokens) */
  omitMemoryFiles?: boolean
  /** Maximum turns for the agent */
  maxTurns?: number
  /** Permission mode override */
  permissionMode?: string
  /** Whether to use parent's exact tool pool (for fork cache optimization) */
  useExactTools?: boolean
  /** Get the system prompt for this agent */
  getSystemPrompt: (context?: { parentPrompt?: string }) => string
}

// ============================================================================
// One-shot agents (skip agentId/SendMessage trailer to save tokens)
// ============================================================================

export const ONE_SHOT_AGENT_TYPES = new Set(['Explore', 'Plan'])

// ============================================================================
// Tool filtering constants
// ============================================================================

/** Tools that no agent (built-in or custom) can use */
export const ALL_AGENT_DISALLOWED_TOOLS = new Set([
  'TeamCreate',
  'TeamDelete',
])

/** Additional tools blocked for custom agents */
export const CUSTOM_AGENT_DISALLOWED_TOOLS = new Set([
  'ScheduleCronCreate',
  'ScheduleCronDelete',
])

// ============================================================================
// Built-in agent definitions
// ============================================================================

export const GENERAL_PURPOSE_AGENT: AgentDefinition = {
  agentType: 'general-purpose',
  whenToUse: 'General-purpose agent for researching complex questions, analyzing codebases, performing multi-step tasks, and any work that benefits from parallel execution.',
  tools: ['*'],
  source: 'built-in',
  model: 'inherit',
  maxTurns: 100,

  getSystemPrompt() {
    return `You are a subagent working on a specific task. Given the user's message, use the tools available to complete the task thoroughly.

Strengths:
- Searching for code, configurations, and patterns across large codebases
- Analyzing multiple files to understand system architecture
- Investigating complex questions that require exploring many files
- Performing multi-step research and implementation tasks

Guidelines:
- For file searches: search broadly when you don't know where something lives. Check multiple directories, use different search patterns, look at imports and references.
- For analysis: start broad and narrow down. Read high-level files first, then dive into specifics.
- Be thorough: check multiple locations, consider different naming conventions, look at tests and configs.
- Complete the task fully — don't gold-plate, but don't leave it half-done.
- NEVER create files unless absolutely necessary for the task.
- NEVER proactively create documentation files or README updates.
- When finished, provide a clear summary of what you found or accomplished.`
  },
}

export const EXPLORE_AGENT: AgentDefinition = {
  agentType: 'Explore',
  whenToUse: 'Fast agent specialized for exploring and searching codebases. Read-only — cannot modify files. Use for finding code, understanding architecture, tracing dependencies, or answering questions about the codebase. Faster and cheaper than general-purpose agent.',
  tools: ['*'],
  disallowedTools: ['Agent', 'FileEdit', 'Write', 'NotebookEdit', 'ExitPlanMode'],
  source: 'built-in',
  model: 'haiku',
  omitMemoryFiles: true,
  maxTurns: 50,

  getSystemPrompt() {
    return `You are a file search specialist. You excel at thoroughly navigating and exploring codebases to find relevant information.

=== CRITICAL: READ-ONLY MODE ===
You are in READ-ONLY mode. The following are STRICTLY PROHIBITED:
- Creating new files
- Modifying existing files
- Deleting files
- Moving or copying files
- Using redirect operators (>, >>) or heredocs in Bash
- Running any command that writes to disk (mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install)

You may ONLY use Bash for read-only operations: ls, git status, git log, git diff, find, grep, cat, head, tail, wc

Strengths:
- Rapidly finding files using glob patterns
- Searching code with powerful regex patterns
- Reading and analyzing file contents
- Understanding project structure and dependencies

Guidelines:
- Use Glob for broad file pattern matching (*.ts, **/*.py)
- Use Grep for searching file contents with regex
- Use Read when you know the specific file path
- Search broadly first, then narrow down
- Check multiple locations and naming conventions
- Look at imports, exports, and references to trace dependencies
- Provide a concise summary of findings when done`
  },
}

export const PLAN_AGENT: AgentDefinition = {
  agentType: 'Plan',
  whenToUse: 'Software architect agent for designing implementation plans. Read-only — explores the codebase and produces a detailed step-by-step implementation strategy. Use when you need a plan before making changes.',
  tools: ['*'],
  disallowedTools: ['Agent', 'FileEdit', 'Write', 'NotebookEdit', 'ExitPlanMode'],
  source: 'built-in',
  model: 'inherit',
  omitMemoryFiles: true,
  maxTurns: 50,

  getSystemPrompt() {
    return `You are a software architect and planning specialist. Your role is to explore the codebase and design implementation plans.

=== CRITICAL: READ-ONLY MODE ===
You are in READ-ONLY mode. Same restrictions as the Explore agent — you CANNOT create, modify, or delete any files.

Process:
1. Understand Requirements — parse what the user wants to achieve
2. Explore Thoroughly — use Glob, Grep, Read to understand the existing codebase
3. Design Solution — based on the patterns and architecture you found
4. Detail the Plan — step-by-step implementation strategy

Your output MUST include:
### Implementation Plan
1. Step-by-step actions with specific file paths
2. What to create, modify, or delete
3. Key decisions and trade-offs

### Critical Files
List the 3-5 files most critical for implementing this plan, with brief rationale.

### Risks & Considerations
Any potential issues, edge cases, or dependencies to be aware of.

Guidelines:
- Ground your plan in the actual codebase — don't guess at file paths or patterns
- Follow existing conventions and patterns in the project
- Consider test coverage and how to verify the changes
- Be specific about file paths, function names, and code patterns`
  },
}

// ============================================================================
// Agent registry
// ============================================================================

const BUILT_IN_AGENTS: AgentDefinition[] = [
  GENERAL_PURPOSE_AGENT,
  EXPLORE_AGENT,
  PLAN_AGENT,
]

/**
 * Find a built-in agent by type name (case-insensitive).
 */
export function findBuiltInAgent(agentType: string): AgentDefinition | undefined {
  return BUILT_IN_AGENTS.find(
    a => a.agentType.toLowerCase() === agentType.toLowerCase(),
  )
}

/**
 * Get all built-in agent definitions.
 */
export function getBuiltInAgents(): AgentDefinition[] {
  return [...BUILT_IN_AGENTS]
}

/**
 * Get the agent selection prompt (shown to the model so it knows what agents are available).
 */
export function getAgentSelectionPrompt(): string {
  const lines = ['Available subagent types:']
  for (const agent of BUILT_IN_AGENTS) {
    lines.push(`  - ${agent.agentType}: ${agent.whenToUse}`)
  }
  return lines.join('\n')
}

// ============================================================================
// Tool filtering
// ============================================================================

/**
 * Filter tools for an agent based on its definition.
 * - Removes globally disallowed tools
 * - Removes agent-specific disallowed tools
 * - For custom agents, removes additional restricted tools
 * - Always allows MCP tools (mcp__* prefix)
 */
export function filterToolsForAgent(
  tools: Array<{ name: string }>,
  agentDef: AgentDefinition,
): Array<{ name: string }> {
  const disallowed = new Set<string>([
    ...ALL_AGENT_DISALLOWED_TOOLS,
    ...(agentDef.disallowedTools ?? []),
  ])

  if (agentDef.source === 'custom') {
    for (const tool of CUSTOM_AGENT_DISALLOWED_TOOLS) {
      disallowed.add(tool)
    }
  }

  return tools.filter(t => {
    // Always allow MCP tools
    if (t.name.startsWith('mcp__')) return true
    // Filter by disallowed list
    return !disallowed.has(t.name)
  })
}
