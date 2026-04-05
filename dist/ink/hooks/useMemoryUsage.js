/**
 * useMemoryUsage — monitor Node.js process memory usage.
 *
 * Ported from Claude Code's useMemoryUsage.ts.
 * Polls every 10 seconds; returns null while status is 'normal'.
 * Only triggers re-renders when status transitions (normal → high/critical).
 */
import { useState } from 'react';
import { useInterval } from './useInterval.js';
const HIGH_MEMORY_THRESHOLD = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const CRITICAL_MEMORY_THRESHOLD = 2.5 * 1024 * 1024 * 1024; // 2.5GB
const POLL_INTERVAL_MS = 10_000;
/**
 * Hook to monitor Node.js process memory usage.
 * Returns null when status is 'normal' to avoid unnecessary re-renders.
 */
export function useMemoryUsage() {
    const [memoryUsage, setMemoryUsage] = useState(null);
    useInterval(() => {
        const heapUsed = process.memoryUsage().heapUsed;
        const status = heapUsed >= CRITICAL_MEMORY_THRESHOLD
            ? 'critical'
            : heapUsed >= HIGH_MEMORY_THRESHOLD
                ? 'high'
                : 'normal';
        setMemoryUsage(prev => {
            // Bail when status is 'normal' — avoid re-rendering for the 99%+
            // of users who never reach 1.5GB heap usage.
            if (status === 'normal')
                return prev === null ? prev : null;
            return { heapUsed, status };
        });
    }, POLL_INTERVAL_MS);
    return memoryUsage;
}
//# sourceMappingURL=useMemoryUsage.js.map