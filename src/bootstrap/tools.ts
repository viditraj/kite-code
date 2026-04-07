/**
 * Tool bootstrap — registers all built-in tools at startup.
 *
 * This must be called before any code that uses getAllBaseTools().
 * Equivalent to Claude Code's tool registration in setup.ts.
 */

import { registerTools } from '../tools.js'
import { BashTool } from '../tools/BashTool/BashTool.js'
import { FileReadTool } from '../tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from '../tools/FileWriteTool/FileWriteTool.js'
import { FileEditTool } from '../tools/FileEditTool/FileEditTool.js'
import { GrepTool } from '../tools/GrepTool/GrepTool.js'
import { GlobTool } from '../tools/GlobTool/GlobTool.js'
import { WebFetchTool } from '../tools/WebFetchTool/WebFetchTool.js'
import { AgentTool } from '../tools/AgentTool/AgentTool.js'
import { TodoWriteTool } from '../tools/TodoWriteTool/TodoWriteTool.js'
import { AskUserQuestionTool } from '../tools/AskUserQuestionTool/AskUserQuestionTool.js'
import { NotebookEditTool } from '../tools/NotebookEditTool/NotebookEditTool.js'
import { ToolSearchTool } from '../tools/ToolSearchTool/ToolSearchTool.js'
import { WebSearchTool } from '../tools/WebSearchTool/WebSearchTool.js'
import { EnterPlanModeTool, ExitPlanModeTool } from '../tools/PlanModeTool/PlanModeTool.js'
import { PowerShellTool } from '../tools/PowerShellTool/PowerShellTool.js'
import { SleepTool } from '../tools/SleepTool/SleepTool.js'
import { ConfigTool } from '../tools/ConfigTool/ConfigTool.js'
import { EnterWorktreeTool, ExitWorktreeTool } from '../tools/WorktreeTool/WorktreeTool.js'
import { ListMcpResourcesTool } from '../tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
import { ReadMcpResourceTool } from '../tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
import { SkillTool } from '../tools/SkillTool/SkillTool.js'
import { ScheduleCronCreate, ScheduleCronList, ScheduleCronDelete } from '../tools/ScheduleCronTool/ScheduleCronTool.js'
import { LSPTool } from '../tools/LSPTool/LSPTool.js'
import { SendMessageTool } from '../tools/SendMessageTool/SendMessageTool.js'
import { SyntheticOutputTool } from '../tools/SyntheticOutputTool/SyntheticOutputTool.js'
import { MonitorTool } from '../tools/MonitorTool/MonitorTool.js'
import { VerifyPlanTool } from '../tools/VerifyPlanTool/VerifyPlanTool.js'
import { DiagramTool } from '../tools/DiagramTool/DiagramTool.js'
import { TeamCreateTool } from '../tools/TeamCreateTool/TeamCreateTool.js'
import { TeamDeleteTool } from '../tools/TeamDeleteTool/TeamDeleteTool.js'
import { REPLTool } from '../tools/REPLTool/REPLTool.js'
import {
  TaskCreateTool,
  TaskGetTool,
  TaskListTool,
  TaskUpdateTool,
  TaskStopTool,
  TaskOutputTool,
} from '../tools/TaskTools/TaskTools.js'
import { HttpRequestTool } from '../tools/HttpRequestTool/HttpRequestTool.js'
import {
  PipelineRunTool,
  PipelineListTool,
  PipelineStatusTool,
  PipelineValidateTool,
  PipelineDeleteTool,
} from '../tools/PipelineTool/PipelineTool.js'

/**
 * All built-in tools in the order they should be registered.
 * Core tools first (always loaded), then deferred tools.
 */
const ALL_BUILTIN_TOOLS = [
  // Core tools (always loaded)
  BashTool,
  PowerShellTool,
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  GrepTool,
  GlobTool,
  LSPTool,
  WebFetchTool,
  // Agent tools
  AgentTool,
  TodoWriteTool,
  AskUserQuestionTool,
  SendMessageTool,
  // Team/swarm tools
  TeamCreateTool,
  TeamDeleteTool,
  // Task management tools
  TaskCreateTool,
  TaskGetTool,
  TaskListTool,
  TaskUpdateTool,
  TaskStopTool,
  TaskOutputTool,
  // REPL batch execution
  REPLTool,
  // Deferred tools
  NotebookEditTool,
  ToolSearchTool,
  WebSearchTool,
  EnterPlanModeTool,
  ExitPlanModeTool,
  // Utility tools
  SleepTool,
  ConfigTool,
  MonitorTool,
  DiagramTool,
  SyntheticOutputTool,
  VerifyPlanTool,
  SkillTool,
  // Worktree tools
  EnterWorktreeTool,
  ExitWorktreeTool,
  // MCP resource tools
  ListMcpResourcesTool,
  ReadMcpResourceTool,
  // Cron scheduling tools
  ScheduleCronCreate,
  ScheduleCronList,
  ScheduleCronDelete,
  // HTTP client tool
  HttpRequestTool,
  // Pipeline tools
  PipelineRunTool,
  PipelineListTool,
  PipelineStatusTool,
  PipelineValidateTool,
  PipelineDeleteTool,
]

let bootstrapped = false

/**
 * Register all built-in tools. Safe to call multiple times.
 */
export function bootstrapTools(): void {
  if (bootstrapped) return
  registerTools(ALL_BUILTIN_TOOLS)
  bootstrapped = true
}
