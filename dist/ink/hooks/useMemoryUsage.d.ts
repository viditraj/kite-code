/**
 * useMemoryUsage — monitor Node.js process memory usage.
 *
 * Ported from Claude Code's useMemoryUsage.ts.
 * Polls every 10 seconds; returns null while status is 'normal'.
 * Only triggers re-renders when status transitions (normal → high/critical).
 */
export type MemoryUsageStatus = 'normal' | 'high' | 'critical';
export interface MemoryUsageInfo {
    heapUsed: number;
    status: MemoryUsageStatus;
}
/**
 * Hook to monitor Node.js process memory usage.
 * Returns null when status is 'normal' to avoid unnecessary re-renders.
 */
export declare function useMemoryUsage(): MemoryUsageInfo | null;
//# sourceMappingURL=useMemoryUsage.d.ts.map