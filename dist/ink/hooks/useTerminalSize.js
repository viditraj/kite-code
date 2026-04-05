/**
 * useTerminalSize hook — get current terminal dimensions.
 *
 * Wraps ink's useStdout to provide reactive terminal size,
 * matching Claude Code's useTerminalSize pattern.
 */
import { useStdout } from 'ink';
import { useState, useEffect } from 'react';
/**
 * Returns current terminal dimensions, updating on resize.
 */
export function useTerminalSize() {
    const { stdout } = useStdout();
    const [size, setSize] = useState({
        columns: stdout?.columns ?? 80,
        rows: stdout?.rows ?? 24,
    });
    useEffect(() => {
        if (!stdout)
            return;
        const handleResize = () => {
            setSize({
                columns: stdout.columns ?? 80,
                rows: stdout.rows ?? 24,
            });
        };
        stdout.on('resize', handleResize);
        return () => { stdout.off('resize', handleResize); };
    }, [stdout]);
    return size;
}
//# sourceMappingURL=useTerminalSize.js.map