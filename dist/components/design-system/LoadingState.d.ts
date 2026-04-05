/**
 * LoadingState — Skeleton / placeholder for loading content.
 *
 * Renders rows of ░ block characters to indicate content is loading.
 * Use this as a placeholder while data is being fetched.
 *
 * @example
 * // Default 3 lines, width 20
 * <LoadingState />
 *
 * // Custom size
 * <LoadingState lines={5} width={40} />
 */
import React from 'react';
export type LoadingStateProps = {
    /** Number of placeholder lines. @default 3 */
    lines?: number;
    /** Width of each line in characters. @default 20 */
    width?: number;
};
export declare function LoadingState({ lines, width, }: LoadingStateProps): React.ReactElement;
export default LoadingState;
//# sourceMappingURL=LoadingState.d.ts.map