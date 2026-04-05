/**
 * Session persistence — JSONL format + Markdown export.
 *
 * Each session is stored as a .jsonl file in ~/.kite/sessions/.
 * One JSON object per line: first line is always metadata, subsequent
 * lines are message / tool_result / system entries.
 *
 * Provides: create, append, load, list, delete, cleanup, export, search.
 */
import type { UnifiedMessage } from '../providers/types.js';
export interface SessionMetadata {
    id: string;
    title: string;
    model: string;
    cwd: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    tokenCount?: number;
    costUSD?: number;
}
export interface SessionEntry {
    type: 'message' | 'metadata' | 'tool_result' | 'system';
    timestamp: number;
    data: Record<string, unknown>;
}
export interface SavedSession {
    metadata: SessionMetadata;
    messages: UnifiedMessage[];
}
/**
 * Returns the full path to the sessions directory (~/.kite/sessions/).
 * Creates it (recursively) if it doesn't exist.
 */
export declare function getSessionsDir(): string;
/**
 * Returns the full path to a session's JSONL file.
 */
export declare function getSessionFilePath(sessionId: string): string;
/**
 * Returns the full path to a session's markdown export.
 */
export declare function getSessionMdPath(sessionId: string): string;
/**
 * Returns a new UUID-based session ID (first 8 chars of a UUID for brevity).
 */
export declare function generateSessionId(): string;
/**
 * Generate a human-readable title from the first user message.
 *
 * - Finds the first message with role === 'user'
 * - Extracts the first 80 characters of its text content
 * - Strips newlines and trims whitespace
 * - Falls back to "Untitled session"
 */
export declare function generateSessionTitle(messages: UnifiedMessage[]): string;
/**
 * Create a new session with metadata.
 * Writes an initial metadata entry to the JSONL file and returns the metadata.
 */
export declare function createSession(model: string, cwd: string): SessionMetadata;
/**
 * Append a message to the session's JSONL file.
 *
 * Entry format: `{ type: 'message', timestamp, data: { role, content } }`
 */
export declare function appendMessage(sessionId: string, message: UnifiedMessage): void;
/**
 * Append a tool result entry to the session's JSONL file.
 */
export declare function appendToolResult(sessionId: string, toolUseId: string, toolName: string, result: string, isError: boolean): void;
/**
 * Load a session from disk.
 *
 * Reads the JSONL file line by line, extracts metadata from the first entry,
 * reconstructs messages from message entries, and returns a SavedSession.
 * Returns null if the file doesn't exist or is unreadable.
 */
export declare function loadSession(sessionId: string): SavedSession | null;
/**
 * List recent sessions.
 *
 * Reads all .jsonl files in the sessions dir, parses metadata from the
 * first line of each, sorts by updatedAt descending, and limits to `limit`
 * (default MAX_SESSIONS).
 */
export declare function listSessions(limit?: number): SessionMetadata[];
/**
 * Delete a session file (and its markdown export if present).
 * Returns true if the JSONL file was deleted, false otherwise.
 */
export declare function deleteSession(sessionId: string): boolean;
/**
 * Delete sessions older than MAX_SESSION_AGE_DAYS.
 * Returns the count of deleted sessions.
 */
export declare function cleanupOldSessions(): number;
/**
 * Export a session as Markdown.
 *
 * Loads the session, formats it as readable Markdown with headers, role
 * labels, and fenced code blocks for tool results, then writes the .md
 * file alongside the .jsonl file.
 *
 * Returns the Markdown content, or null if the session cannot be loaded.
 */
export declare function exportSessionToMarkdown(sessionId: string): string | null;
/**
 * Bulk save/update a session.
 *
 * Rewrites the entire JSONL file with current state:
 * 1. Updated metadata (messageCount, updatedAt, tokenCount, costUSD)
 * 2. All messages as entries
 */
export declare function saveSessionState(sessionId: string, messages: UnifiedMessage[], metadata: Partial<SessionMetadata>): void;
/**
 * Get titles of recent sessions for the resume picker.
 *
 * Returns an array of { id, title, date } objects sorted by most recent first.
 */
export declare function getRecentSessionTitles(limit?: number): Array<{
    id: string;
    title: string;
    date: string;
}>;
/**
 * Search sessions by title (case-insensitive substring match).
 * Returns the first matching session's metadata, or null.
 */
export declare function findSessionByTitle(query: string): SessionMetadata | null;
/**
 * Update only the metadata (first line) of a session's JSONL file.
 *
 * This is a lightweight alternative to saveSessionState() that preserves
 * all existing message entries and only rewrites the metadata line.
 */
export declare function updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): void;
//# sourceMappingURL=session.d.ts.map