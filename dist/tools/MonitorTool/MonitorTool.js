/**
 * MonitorTool — System monitoring using OS module and shell commands.
 *
 * Reports system metrics:
 * - cpu: CPU info and load averages
 * - memory: Total, free, and used memory
 * - disk: Disk usage via `df -h`
 * - all: All of the above
 *
 * Auto-allowed, read-only.
 */
import { z } from 'zod';
import { cpus, totalmem, freemem, uptime, loadavg, platform, hostname, arch, release } from 'os';
import { execSync } from 'child_process';
import { buildTool } from '../../Tool.js';
const MONITOR_TOOL_NAME = 'Monitor';
const inputSchema = z.strictObject({
    metric: z.enum(['cpu', 'memory', 'disk', 'all']).describe('Which metric to report: "cpu", "memory", "disk", or "all"'),
});
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}
function getCpuReport() {
    const cpuInfo = cpus();
    const loads = loadavg();
    const cpuModel = cpuInfo.length > 0 ? cpuInfo[0].model : 'Unknown';
    const cpuCount = cpuInfo.length;
    const cpuSpeed = cpuInfo.length > 0 ? cpuInfo[0].speed : 0;
    const lines = [
        'CPU Information:',
        `  Model: ${cpuModel}`,
        `  Cores: ${cpuCount}`,
        `  Speed: ${cpuSpeed} MHz`,
        `  Load Average (1m, 5m, 15m): ${loads.map(l => l.toFixed(2)).join(', ')}`,
        `  Platform: ${platform()} ${arch()}`,
        `  Hostname: ${hostname()}`,
        `  OS Release: ${release()}`,
        `  Uptime: ${formatUptime(uptime())}`,
    ];
    return {
        text: lines.join('\n'),
        data: {
            model: cpuModel,
            cores: cpuCount,
            speed: cpuSpeed,
            loadAverage: { '1m': loads[0], '5m': loads[1], '15m': loads[2] },
            platform: platform(),
            arch: arch(),
            hostname: hostname(),
            uptime: uptime(),
        },
    };
}
function getMemoryReport() {
    const total = totalmem();
    const free = freemem();
    const used = total - free;
    const usagePercent = ((used / total) * 100).toFixed(1);
    const lines = [
        'Memory Information:',
        `  Total: ${formatBytes(total)}`,
        `  Used: ${formatBytes(used)} (${usagePercent}%)`,
        `  Free: ${formatBytes(free)}`,
    ];
    return {
        text: lines.join('\n'),
        data: {
            totalBytes: total,
            usedBytes: used,
            freeBytes: free,
            usagePercent: parseFloat(usagePercent),
        },
    };
}
function getDiskReport() {
    try {
        const output = execSync('df -h', {
            encoding: 'utf-8',
            timeout: 10_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return {
            text: `Disk Usage:\n${output.trim()}`,
            data: { raw: output.trim() },
        };
    }
    catch (err) {
        // Fallback for Windows or systems without df
        try {
            const output = execSync('wmic logicaldisk get size,freespace,caption', {
                encoding: 'utf-8',
                timeout: 10_000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return {
                text: `Disk Usage:\n${output.trim()}`,
                data: { raw: output.trim() },
            };
        }
        catch {
            return {
                text: 'Disk Usage: Unable to retrieve disk information on this platform.',
                data: { error: 'Could not execute disk reporting command' },
            };
        }
    }
}
export const MonitorTool = buildTool({
    name: MONITOR_TOOL_NAME,
    searchHint: 'system monitoring cpu memory disk usage metrics',
    maxResultSizeChars: 30_000,
    strict: true,
    shouldDefer: true,
    inputSchema,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    async description({ metric }) {
        return `Report system ${metric} metrics`;
    },
    async prompt() {
        return `Report system monitoring metrics.

Input:
- metric: One of "cpu", "memory", "disk", or "all"

Metrics:
- "cpu": CPU model, core count, speed, load averages, platform info, and uptime
- "memory": Total, used, and free memory with usage percentage
- "disk": Disk usage information (via df -h on Unix or wmic on Windows)
- "all": All of the above combined

This is a read-only tool that reports current system state.`;
    },
    async checkPermissions(input) {
        return { behavior: 'allow', updatedInput: input };
    },
    userFacingName() {
        return 'Monitor';
    },
    toAutoClassifierInput(input) {
        return `monitor ${input.metric}`;
    },
    getToolUseSummary(input) {
        if (!input?.metric)
            return null;
        return `Monitoring ${input.metric}`;
    },
    getActivityDescription(input) {
        if (!input?.metric)
            return 'Monitoring system';
        return `Monitoring system ${input.metric}`;
    },
    async call(input) {
        const sections = [];
        const allData = {};
        if (input.metric === 'cpu' || input.metric === 'all') {
            const cpu = getCpuReport();
            sections.push(cpu.text);
            allData.cpu = cpu.data;
        }
        if (input.metric === 'memory' || input.metric === 'all') {
            const memory = getMemoryReport();
            sections.push(memory.text);
            allData.memory = memory.data;
        }
        if (input.metric === 'disk' || input.metric === 'all') {
            const disk = getDiskReport();
            sections.push(disk.text);
            allData.disk = disk.data;
        }
        const report = sections.join('\n\n');
        return {
            data: {
                metric: input.metric,
                report,
                data: allData,
            },
        };
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.report,
        };
    },
});
export { MONITOR_TOOL_NAME };
//# sourceMappingURL=MonitorTool.js.map