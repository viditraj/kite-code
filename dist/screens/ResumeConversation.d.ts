/**
 * ResumeConversation — Session resume screen.
 *
 * Implements the same pattern as Claude Code's ResumeConversation.tsx:
 * - Lists recent sessions with titles and dates
 * - Arrow key navigation to select a session
 * - Enter to resume, Escape to cancel
 * - Loads session messages and restores conversation state
 */
import React from 'react';
import { type SessionMetadata } from '../utils/session.js';
import type { UnifiedMessage } from '../providers/types.js';
export interface ResumeConversationProps {
    onResume: (messages: UnifiedMessage[], metadata: SessionMetadata) => void;
    onCancel: () => void;
    initialQuery?: string;
    sessionId?: string;
}
export declare const ResumeConversation: React.FC<ResumeConversationProps>;
//# sourceMappingURL=ResumeConversation.d.ts.map