import React, { useMemo } from 'react'
import { Box, Text } from 'ink'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'running' | 'killed'

export interface TaskInfo {
  id: string
  subject: string
  description?: string
  status: TaskStatus
  owner?: string
  type?: 'bash' | 'agent' | 'task' | 'dream'
  blocks?: string[]
  blockedBy?: string[]
  createdAt?: number
  updatedAt?: number
  progress?: {
    lastActivity?: string
    toolCount?: number
    tokenCount?: number
    elapsedMs?: number
  }
}

// ---------------------------------------------------------------------------
// Status utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the task status represents a terminal (finished) state.
 */
export function isTerminalStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}

/**
 * Returns an icon character representing the task status.
 */
export function getTaskStatusIcon(
  status: TaskStatus,
  options?: { isIdle?: boolean; hasError?: boolean },
): string {
  const isIdle = options?.isIdle ?? false
  const hasError = options?.hasError ?? false

  if (hasError) {
    return '✗'
  }

  switch (status) {
    case 'running':
    case 'in_progress':
      return isIdle ? '…' : '▶'
    case 'completed':
      return '✓'
    case 'failed':
    case 'killed':
      return '✗'
    case 'pending':
    default:
      return '○'
  }
}

/**
 * Returns a color name appropriate for the given task status.
 */
export function getTaskStatusColor(
  status: TaskStatus,
  options?: { isIdle?: boolean; hasError?: boolean },
): string {
  const hasError = options?.hasError ?? false

  if (hasError) {
    return 'red'
  }

  switch (status) {
    case 'completed':
      return 'green'
    case 'failed':
    case 'killed':
      return 'red'
    case 'running':
    case 'in_progress':
      return 'cyan'
    case 'pending':
    default:
      return 'gray'
  }
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatTaskDuration(ms: number): string {
  if (ms < 0) {
    return '<1s'
  }

  const totalSeconds = Math.floor(ms / 1000)

  if (totalSeconds < 1) {
    return '<1s'
  }

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const totalMinutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  if (totalMinutes < 60) {
    return `${totalMinutes}m ${remainingSeconds}s`
  }

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  return `${hours}h ${remainingMinutes}m`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`
  }
  return String(n)
}

// ---------------------------------------------------------------------------
// TaskRow component
// ---------------------------------------------------------------------------

export interface TaskRowProps {
  task: TaskInfo
  isSelected?: boolean
  showDetails?: boolean
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  isSelected = false,
  showDetails = false,
}) => {
  const icon = getTaskStatusIcon(task.status)
  const color = getTaskStatusColor(task.status)
  const isBlocked = task.blockedBy && task.blockedBy.length > 0

  const statusLabel = task.status.replace('_', ' ')

  return (
    <Box
      flexDirection="column"
      borderStyle={isSelected ? 'single' : undefined}
      borderColor={isSelected ? 'cyan' : undefined}
      paddingLeft={isSelected ? 1 : 0}
      paddingRight={isSelected ? 1 : 0}
    >
      {/* Main row */}
      <Box>
        <Text color={color} bold={isSelected}>
          {icon}{' '}
        </Text>
        <Text bold={isSelected}>
          #{task.id} [{statusLabel}] {task.subject}
        </Text>
      </Box>

      {/* Blocked indicator */}
      {isBlocked && (
        <Box paddingLeft={2}>
          <Text color="yellow">
            ⚠ blocked by: {task.blockedBy!.map((id) => `#${id}`).join(', ')}
          </Text>
        </Box>
      )}

      {/* Detail section */}
      {showDetails && (
        <Box flexDirection="column" paddingLeft={2}>
          {/* Description */}
          {task.description && (
            <Box>
              <Text dimColor>{task.description}</Text>
            </Box>
          )}

          {/* Owner */}
          {task.owner && (
            <Box>
              <Text color="gray">owner: </Text>
              <Text>{task.owner}</Text>
            </Box>
          )}

          {/* Type */}
          {task.type && (
            <Box>
              <Text color="gray">type: </Text>
              <Text>{task.type}</Text>
            </Box>
          )}

          {/* Blocks */}
          {task.blocks && task.blocks.length > 0 && (
            <Box>
              <Text color="gray">blocks: </Text>
              <Text>{task.blocks.map((id) => `#${id}`).join(', ')}</Text>
            </Box>
          )}

          {/* Duration */}
          {task.progress?.elapsedMs !== undefined && (
            <Box>
              <Text color="gray">elapsed: </Text>
              <Text>{formatTaskDuration(task.progress.elapsedMs)}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// TaskList component
// ---------------------------------------------------------------------------

export interface TaskListProps {
  tasks: TaskInfo[]
  selectedId?: string
  showCompleted?: boolean
  maxVisible?: number
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  selectedId,
  showCompleted = false,
  maxVisible,
}) => {
  const filteredTasks = useMemo(() => {
    if (showCompleted) {
      return tasks
    }
    return tasks.filter((t) => !isTerminalStatus(t.status))
  }, [tasks, showCompleted])

  const activeCount = useMemo(
    () => tasks.filter((t) => !isTerminalStatus(t.status)).length,
    [tasks],
  )

  const visibleTasks = useMemo(() => {
    if (maxVisible !== undefined && maxVisible > 0 && filteredTasks.length > maxVisible) {
      return filteredTasks.slice(0, maxVisible)
    }
    return filteredTasks
  }, [filteredTasks, maxVisible])

  const hiddenCount = filteredTasks.length - visibleTasks.length

  if (filteredTasks.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Tasks ({activeCount})</Text>
        <Box paddingLeft={1}>
          <Text dimColor>No active tasks</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Tasks ({activeCount})</Text>
      <Box flexDirection="column" paddingLeft={1}>
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isSelected={selectedId === task.id}
            showDetails={selectedId === task.id}
          />
        ))}
        {hiddenCount > 0 && (
          <Box paddingLeft={2}>
            <Text dimColor>
              ... and {hiddenCount} more
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// TaskDetailView component
// ---------------------------------------------------------------------------

export interface TaskDetailViewProps {
  task: TaskInfo
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task }) => {
  const icon = getTaskStatusIcon(task.status)
  const color = getTaskStatusColor(task.status)
  const statusLabel = task.status.replace('_', ' ')

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text bold>
          Task #{task.id}: {task.subject}
        </Text>
      </Box>

      {/* Status line */}
      <Box>
        <Text color={color}>
          {icon} {statusLabel}
        </Text>
        {task.type && (
          <Text dimColor> ({task.type})</Text>
        )}
      </Box>

      {/* Description */}
      {task.description && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>Description</Text>
          <Box paddingLeft={1}>
            <Text>{task.description}</Text>
          </Box>
        </Box>
      )}

      {/* Owner */}
      {task.owner && (
        <Box marginTop={1}>
          <Text color="gray" bold>Owner: </Text>
          <Text>{task.owner}</Text>
        </Box>
      )}

      {/* Dependencies */}
      {((task.blocks && task.blocks.length > 0) ||
        (task.blockedBy && task.blockedBy.length > 0)) && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>Dependencies</Text>
          {task.blocks && task.blocks.length > 0 && (
            <Box paddingLeft={1}>
              <Text color="gray">Blocks: </Text>
              <Text>{task.blocks.map((id) => `#${id}`).join(', ')}</Text>
            </Box>
          )}
          {task.blockedBy && task.blockedBy.length > 0 && (
            <Box paddingLeft={1}>
              <Text color="yellow">Blocked by: </Text>
              <Text color="yellow">
                {task.blockedBy.map((id) => `#${id}`).join(', ')}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Progress */}
      {task.progress && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>Progress</Text>
          <Box flexDirection="column" paddingLeft={1}>
            {task.progress.lastActivity && (
              <Box>
                <Text color="gray">Last activity: </Text>
                <Text>{task.progress.lastActivity}</Text>
              </Box>
            )}
            {task.progress.toolCount !== undefined && (
              <Box>
                <Text color="gray">Tool calls: </Text>
                <Text>{formatNumber(task.progress.toolCount)}</Text>
              </Box>
            )}
            {task.progress.tokenCount !== undefined && (
              <Box>
                <Text color="gray">Tokens: </Text>
                <Text>{formatNumber(task.progress.tokenCount)}</Text>
              </Box>
            )}
            {task.progress.elapsedMs !== undefined && (
              <Box>
                <Text color="gray">Elapsed: </Text>
                <Text>{formatTaskDuration(task.progress.elapsedMs)}</Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Timestamps */}
      {(task.createdAt !== undefined || task.updatedAt !== undefined) && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>Timestamps</Text>
          <Box flexDirection="column" paddingLeft={1}>
            {task.createdAt !== undefined && (
              <Box>
                <Text color="gray">Created: </Text>
                <Text>{formatTimestamp(task.createdAt)}</Text>
              </Box>
            )}
            {task.updatedAt !== undefined && (
              <Box>
                <Text color="gray">Updated: </Text>
                <Text>{formatTimestamp(task.updatedAt)}</Text>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// BackgroundTasksBar component
// ---------------------------------------------------------------------------

export interface BackgroundTasksBarProps {
  tasks: TaskInfo[]
}

export const BackgroundTasksBar: React.FC<BackgroundTasksBarProps> = ({ tasks }) => {
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'running' || t.status === 'in_progress' || t.status === 'pending'),
    [tasks],
  )

  if (activeTasks.length === 0) {
    return null
  }

  // Find the most recently updated task, falling back to the last in the list
  const latestTask = useMemo(() => {
    let best = activeTasks[0]
    for (const t of activeTasks) {
      if (
        t.updatedAt !== undefined &&
        (best.updatedAt === undefined || t.updatedAt > best.updatedAt)
      ) {
        best = t
      }
    }
    return best
  }, [activeTasks])

  const latestIcon = getTaskStatusIcon(latestTask.status)
  const latestColor = getTaskStatusColor(latestTask.status)
  const latestStatusLabel = latestTask.status.replace('_', ' ')

  return (
    <Box>
      <Text color="gray">[</Text>
      <Text bold>{activeTasks.length}</Text>
      <Text color="gray"> task{activeTasks.length !== 1 ? 's' : ''}] </Text>
      <Text color={latestColor}>
        {latestIcon} {latestTask.subject}
      </Text>
      <Text dimColor> ({latestStatusLabel})</Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// TaskProgressIndicator component
// ---------------------------------------------------------------------------

export interface TaskProgressIndicatorProps {
  task: TaskInfo
  compact?: boolean
}

export const TaskProgressIndicator: React.FC<TaskProgressIndicatorProps> = ({
  task,
  compact = false,
}) => {
  const icon = getTaskStatusIcon(task.status)
  const color = getTaskStatusColor(task.status)

  const elapsedStr =
    task.progress?.elapsedMs !== undefined
      ? formatTaskDuration(task.progress.elapsedMs)
      : undefined

  if (compact) {
    return (
      <Box>
        <Text color={color}>{icon} </Text>
        <Text>{task.subject}</Text>
        {elapsedStr && (
          <Text dimColor> ({elapsedStr})</Text>
        )}
      </Box>
    )
  }

  // Full / expanded view
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color} bold>
          {icon} {task.subject}
        </Text>
        {elapsedStr && (
          <Text dimColor> [{elapsedStr}]</Text>
        )}
      </Box>

      {task.progress?.lastActivity && (
        <Box paddingLeft={2}>
          <Text dimColor>{task.progress.lastActivity}</Text>
        </Box>
      )}

      <Box paddingLeft={2}>
        {task.progress?.toolCount !== undefined && (
          <Box marginRight={2}>
            <Text color="gray">tools: </Text>
            <Text>{formatNumber(task.progress.toolCount)}</Text>
          </Box>
        )}
        {task.progress?.tokenCount !== undefined && (
          <Box>
            <Text color="gray">tokens: </Text>
            <Text>{formatNumber(task.progress.tokenCount)}</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
