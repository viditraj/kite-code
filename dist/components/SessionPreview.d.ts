/**
 * SessionPreview — Session card for resume display.
 *
 * Shows a compact card with session info: ID, date, message count,
 * first message preview, and model used. Purely presentational.
 */
import React from 'react';
export interface SessionPreviewProps {
    /** Unique session identifier. */
    sessionId: string;
    /** Human-readable date string. */
    date: string;
    /** Number of messages in the session. */
    messageCount: number;
    /** First message content (truncated). */
    firstMessage?: string;
    /** Model used in this session. */
    model?: string;
}
export declare function SessionPreview({ sessionId, date, messageCount, firstMessage, model, }: SessionPreviewProps): React.ReactElement;
//# sourceMappingURL=SessionPreview.d.ts.map