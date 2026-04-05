import React from 'react';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'running' | 'killed';
export interface TaskInfo {
    id: string;
    subject: string;
    description?: string;
    status: TaskStatus;
    owner?: string;
    type?: 'bash' | 'agent' | 'task' | 'dream';
    blocks?: string[];
    blockedBy?: string[];
    createdAt?: number;
    updatedAt?: number;
    progress?: {
        lastActivity?: string;
        toolCount?: number;
        tokenCount?: number;
        elapsedMs?: number;
    };
}
/**
 * Returns true if the task status represents a terminal (finished) state.
 */
export declare function isTerminalStatus(status: TaskStatus): boolean;
/**
 * Returns an icon character representing the task status.
 */
export declare function getTaskStatusIcon(status: TaskStatus, options?: {
    isIdle?: boolean;
    hasError?: boolean;
}): string;
/**
 * Returns a color name appropriate for the given task status.
 */
export declare function getTaskStatusColor(status: TaskStatus, options?: {
    isIdle?: boolean;
    hasError?: boolean;
}): string;
/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export declare function formatTaskDuration(ms: number): string;
export interface TaskRowProps {
    task: TaskInfo;
    isSelected?: boolean;
    showDetails?: boolean;
}
export declare const TaskRow: React.FC<TaskRowProps>;
export interface TaskListProps {
    tasks: TaskInfo[];
    selectedId?: string;
    showCompleted?: boolean;
    maxVisible?: number;
}
export declare const TaskList: React.FC<TaskListProps>;
export interface TaskDetailViewProps {
    task: TaskInfo;
}
export declare const TaskDetailView: React.FC<TaskDetailViewProps>;
export interface BackgroundTasksBarProps {
    tasks: TaskInfo[];
}
export declare const BackgroundTasksBar: React.FC<BackgroundTasksBarProps>;
export interface TaskProgressIndicatorProps {
    task: TaskInfo;
    compact?: boolean;
}
export declare const TaskProgressIndicator: React.FC<TaskProgressIndicatorProps>;
//# sourceMappingURL=TasksView.d.ts.map