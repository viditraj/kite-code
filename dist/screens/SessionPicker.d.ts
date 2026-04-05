/**
 * SessionPicker — interactive session selection screen.
 *
 * Shown when the user runs `kite -r` (resume) without a session ID.
 * Lists recent sessions with fuzzy search, matching Claude Code's
 * ResumeConversation → LogSelector pattern.
 *
 * Features:
 * - Lists recent sessions sorted by date
 * - Arrow key navigation
 * - Fuzzy search filtering (type to filter)
 * - Shows session title, date, model, message count
 * - Enter to select, Esc/Ctrl+C to cancel
 */
import React from 'react';
import { type SessionMetadata } from '../utils/session.js';
export interface SessionPickerProps {
    /** Callback when a session is selected */
    onSelect: (session: SessionMetadata) => void;
    /** Callback when the user cancels (Esc / Ctrl+C) */
    onCancel: () => void;
    /** Optional initial search query (from `kite -r <search>`) */
    initialSearchQuery?: string;
}
export declare const SessionPicker: React.FC<SessionPickerProps>;
//# sourceMappingURL=SessionPicker.d.ts.map