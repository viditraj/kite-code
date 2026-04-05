/**
 * StatusIcon — Renders a coloured status indicator character.
 *
 * Maps status names to a single Unicode character with an appropriate colour:
 *   - success  -> green checkmark  (✓)
 *   - error    -> red cross        (✗)
 *   - warning  -> yellow warning   (⚠)
 *   - info     -> blue info        (ℹ)
 *   - pending  -> gray circle      (○)
 *   - running  -> cyan spinner     (⟳)
 *
 * @example
 * <StatusIcon status="success" />
 * <Text><StatusIcon status="error" /> Operation failed</Text>
 */
import React from 'react';
export type StatusIconStatus = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';
export type StatusIconProps = {
    /** Status to display. Determines both icon and colour. */
    status: StatusIconStatus;
};
export declare function StatusIcon({ status }: StatusIconProps): React.ReactElement;
export default StatusIcon;
//# sourceMappingURL=StatusIcon.d.ts.map