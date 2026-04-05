import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Box, Text } from 'ink';
// ---------------------------------------------------------------------------
// Status utilities
// ---------------------------------------------------------------------------
/**
 * Returns true if the task status represents a terminal (finished) state.
 */
export function isTerminalStatus(status) {
    return status === 'completed' || status === 'failed' || status === 'killed';
}
/**
 * Returns an icon character representing the task status.
 */
export function getTaskStatusIcon(status, options) {
    const isIdle = options?.isIdle ?? false;
    const hasError = options?.hasError ?? false;
    if (hasError) {
        return '✗';
    }
    switch (status) {
        case 'running':
        case 'in_progress':
            return isIdle ? '…' : '▶';
        case 'completed':
            return '✓';
        case 'failed':
        case 'killed':
            return '✗';
        case 'pending':
        default:
            return '○';
    }
}
/**
 * Returns a color name appropriate for the given task status.
 */
export function getTaskStatusColor(status, options) {
    const hasError = options?.hasError ?? false;
    if (hasError) {
        return 'red';
    }
    switch (status) {
        case 'completed':
            return 'green';
        case 'failed':
        case 'killed':
            return 'red';
        case 'running':
        case 'in_progress':
            return 'cyan';
        case 'pending':
        default:
            return 'gray';
    }
}
/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatTaskDuration(ms) {
    if (ms < 0) {
        return '<1s';
    }
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 1) {
        return '<1s';
    }
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (totalMinutes < 60) {
        return `${totalMinutes}m ${remainingSeconds}s`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimestamp(ts) {
    const date = new Date(ts);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}
function formatNumber(n) {
    if (n >= 1_000_000) {
        return `${(n / 1_000_000).toFixed(1)}M`;
    }
    if (n >= 1_000) {
        return `${(n / 1_000).toFixed(1)}k`;
    }
    return String(n);
}
export const TaskRow = ({ task, isSelected = false, showDetails = false, }) => {
    const icon = getTaskStatusIcon(task.status);
    const color = getTaskStatusColor(task.status);
    const isBlocked = task.blockedBy && task.blockedBy.length > 0;
    const statusLabel = task.status.replace('_', ' ');
    return (_jsxs(Box, { flexDirection: "column", borderStyle: isSelected ? 'single' : undefined, borderColor: isSelected ? 'cyan' : undefined, paddingLeft: isSelected ? 1 : 0, paddingRight: isSelected ? 1 : 0, children: [_jsxs(Box, { children: [_jsxs(Text, { color: color, bold: isSelected, children: [icon, ' '] }), _jsxs(Text, { bold: isSelected, children: ["#", task.id, " [", statusLabel, "] ", task.subject] })] }), isBlocked && (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "yellow", children: ["\u26A0 blocked by: ", task.blockedBy.map((id) => `#${id}`).join(', ')] }) })), showDetails && (_jsxs(Box, { flexDirection: "column", paddingLeft: 2, children: [task.description && (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: task.description }) })), task.owner && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "owner: " }), _jsx(Text, { children: task.owner })] })), task.type && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "type: " }), _jsx(Text, { children: task.type })] })), task.blocks && task.blocks.length > 0 && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "blocks: " }), _jsx(Text, { children: task.blocks.map((id) => `#${id}`).join(', ') })] })), task.progress?.elapsedMs !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "elapsed: " }), _jsx(Text, { children: formatTaskDuration(task.progress.elapsedMs) })] }))] }))] }));
};
export const TaskList = ({ tasks, selectedId, showCompleted = false, maxVisible, }) => {
    const filteredTasks = useMemo(() => {
        if (showCompleted) {
            return tasks;
        }
        return tasks.filter((t) => !isTerminalStatus(t.status));
    }, [tasks, showCompleted]);
    const activeCount = useMemo(() => tasks.filter((t) => !isTerminalStatus(t.status)).length, [tasks]);
    const visibleTasks = useMemo(() => {
        if (maxVisible !== undefined && maxVisible > 0 && filteredTasks.length > maxVisible) {
            return filteredTasks.slice(0, maxVisible);
        }
        return filteredTasks;
    }, [filteredTasks, maxVisible]);
    const hiddenCount = filteredTasks.length - visibleTasks.length;
    if (filteredTasks.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, children: ["Tasks (", activeCount, ")"] }), _jsx(Box, { paddingLeft: 1, children: _jsx(Text, { dimColor: true, children: "No active tasks" }) })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, children: ["Tasks (", activeCount, ")"] }), _jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [visibleTasks.map((task) => (_jsx(TaskRow, { task: task, isSelected: selectedId === task.id, showDetails: selectedId === task.id }, task.id))), hiddenCount > 0 && (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { dimColor: true, children: ["... and ", hiddenCount, " more"] }) }))] })] }));
};
export const TaskDetailView = ({ task }) => {
    const icon = getTaskStatusIcon(task.status);
    const color = getTaskStatusColor(task.status);
    const statusLabel = task.status.replace('_', ' ');
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { children: _jsxs(Text, { bold: true, children: ["Task #", task.id, ": ", task.subject] }) }), _jsxs(Box, { children: [_jsxs(Text, { color: color, children: [icon, " ", statusLabel] }), task.type && (_jsxs(Text, { dimColor: true, children: [" (", task.type, ")"] }))] }), task.description && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", bold: true, children: "Description" }), _jsx(Box, { paddingLeft: 1, children: _jsx(Text, { children: task.description }) })] })), task.owner && (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "gray", bold: true, children: "Owner: " }), _jsx(Text, { children: task.owner })] })), ((task.blocks && task.blocks.length > 0) ||
                (task.blockedBy && task.blockedBy.length > 0)) && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", bold: true, children: "Dependencies" }), task.blocks && task.blocks.length > 0 && (_jsxs(Box, { paddingLeft: 1, children: [_jsx(Text, { color: "gray", children: "Blocks: " }), _jsx(Text, { children: task.blocks.map((id) => `#${id}`).join(', ') })] })), task.blockedBy && task.blockedBy.length > 0 && (_jsxs(Box, { paddingLeft: 1, children: [_jsx(Text, { color: "yellow", children: "Blocked by: " }), _jsx(Text, { color: "yellow", children: task.blockedBy.map((id) => `#${id}`).join(', ') })] }))] })), task.progress && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", bold: true, children: "Progress" }), _jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [task.progress.lastActivity && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Last activity: " }), _jsx(Text, { children: task.progress.lastActivity })] })), task.progress.toolCount !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Tool calls: " }), _jsx(Text, { children: formatNumber(task.progress.toolCount) })] })), task.progress.tokenCount !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Tokens: " }), _jsx(Text, { children: formatNumber(task.progress.tokenCount) })] })), task.progress.elapsedMs !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Elapsed: " }), _jsx(Text, { children: formatTaskDuration(task.progress.elapsedMs) })] }))] })] })), (task.createdAt !== undefined || task.updatedAt !== undefined) && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", bold: true, children: "Timestamps" }), _jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [task.createdAt !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Created: " }), _jsx(Text, { children: formatTimestamp(task.createdAt) })] })), task.updatedAt !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Updated: " }), _jsx(Text, { children: formatTimestamp(task.updatedAt) })] }))] })] }))] }));
};
export const BackgroundTasksBar = ({ tasks }) => {
    const activeTasks = useMemo(() => tasks.filter((t) => t.status === 'running' || t.status === 'in_progress' || t.status === 'pending'), [tasks]);
    if (activeTasks.length === 0) {
        return null;
    }
    // Find the most recently updated task, falling back to the last in the list
    const latestTask = useMemo(() => {
        let best = activeTasks[0];
        for (const t of activeTasks) {
            if (t.updatedAt !== undefined &&
                (best.updatedAt === undefined || t.updatedAt > best.updatedAt)) {
                best = t;
            }
        }
        return best;
    }, [activeTasks]);
    const latestIcon = getTaskStatusIcon(latestTask.status);
    const latestColor = getTaskStatusColor(latestTask.status);
    const latestStatusLabel = latestTask.status.replace('_', ' ');
    return (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "[" }), _jsx(Text, { bold: true, children: activeTasks.length }), _jsxs(Text, { color: "gray", children: [" task", activeTasks.length !== 1 ? 's' : '', "] "] }), _jsxs(Text, { color: latestColor, children: [latestIcon, " ", latestTask.subject] }), _jsxs(Text, { dimColor: true, children: [" (", latestStatusLabel, ")"] })] }));
};
export const TaskProgressIndicator = ({ task, compact = false, }) => {
    const icon = getTaskStatusIcon(task.status);
    const color = getTaskStatusColor(task.status);
    const elapsedStr = task.progress?.elapsedMs !== undefined
        ? formatTaskDuration(task.progress.elapsedMs)
        : undefined;
    if (compact) {
        return (_jsxs(Box, { children: [_jsxs(Text, { color: color, children: [icon, " "] }), _jsx(Text, { children: task.subject }), elapsedStr && (_jsxs(Text, { dimColor: true, children: [" (", elapsedStr, ")"] }))] }));
    }
    // Full / expanded view
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: color, bold: true, children: [icon, " ", task.subject] }), elapsedStr && (_jsxs(Text, { dimColor: true, children: [" [", elapsedStr, "]"] }))] }), task.progress?.lastActivity && (_jsx(Box, { paddingLeft: 2, children: _jsx(Text, { dimColor: true, children: task.progress.lastActivity }) })), _jsxs(Box, { paddingLeft: 2, children: [task.progress?.toolCount !== undefined && (_jsxs(Box, { marginRight: 2, children: [_jsx(Text, { color: "gray", children: "tools: " }), _jsx(Text, { children: formatNumber(task.progress.toolCount) })] })), task.progress?.tokenCount !== undefined && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "tokens: " }), _jsx(Text, { children: formatNumber(task.progress.tokenCount) })] }))] })] }));
};
//# sourceMappingURL=TasksView.js.map