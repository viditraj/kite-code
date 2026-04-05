/**
 * Session persistence — JSONL format + Markdown export.
 *
 * Each session is stored as a .jsonl file in ~/.kite/sessions/.
 * One JSON object per line: first line is always metadata, subsequent
 * lines are message / tool_result / system entries.
 *
 * Provides: create, append, load, list, delete, cleanup, export, search.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, unlinkSync, } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
// ============================================================================
// Constants
// ============================================================================
const SESSIONS_DIR = '.kite/sessions';
const SESSION_EXT = '.jsonl';
const SESSION_MD_EXT = '.md';
const MAX_SESSION_AGE_DAYS = 30;
const MAX_SESSIONS = 100;
// ============================================================================
// Directory & path helpers
// ============================================================================
/**
 * Returns the full path to the sessions directory (~/.kite/sessions/).
 * Creates it (recursively) if it doesn't exist.
 */
export function getSessionsDir() {
    const dir = join(homedir(), SESSIONS_DIR);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
/**
 * Returns the full path to a session's JSONL file.
 */
export function getSessionFilePath(sessionId) {
    return join(getSessionsDir(), `${sessionId}${SESSION_EXT}`);
}
/**
 * Returns the full path to a session's markdown export.
 */
export function getSessionMdPath(sessionId) {
    return join(getSessionsDir(), `${sessionId}${SESSION_MD_EXT}`);
}
// ============================================================================
// ID & title generation
// ============================================================================
/**
 * Returns a new UUID-based session ID (first 8 chars of a UUID for brevity).
 */
export function generateSessionId() {
    return randomUUID().slice(0, 8);
}
/**
 * Generate a human-readable title from the first user message.
 *
 * - Finds the first message with role === 'user'
 * - Extracts the first 80 characters of its text content
 * - Strips newlines and trims whitespace
 * - Falls back to "Untitled session"
 */
export function generateSessionTitle(messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser)
        return 'Untitled session';
    let text = '';
    if (typeof firstUser.content === 'string') {
        text = firstUser.content;
    }
    else if (Array.isArray(firstUser.content)) {
        const textBlock = firstUser.content.find((b) => b.type === 'text');
        if (textBlock) {
            text = textBlock.text;
        }
    }
    if (!text)
        return 'Untitled session';
    const cleaned = text.replace(/[\r\n]+/g, ' ').trim();
    if (!cleaned)
        return 'Untitled session';
    return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
}
// ============================================================================
// Create
// ============================================================================
/**
 * Create a new session with metadata.
 * Writes an initial metadata entry to the JSONL file and returns the metadata.
 */
export function createSession(model, cwd) {
    const id = generateSessionId();
    const now = Date.now();
    const metadata = {
        id,
        title: 'Untitled session',
        model,
        cwd,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
    };
    const entry = {
        type: 'metadata',
        timestamp: now,
        data: metadata,
    };
    const filePath = getSessionFilePath(id);
    writeFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
    return metadata;
}
// ============================================================================
// Append
// ============================================================================
/**
 * Append a message to the session's JSONL file.
 *
 * Entry format: `{ type: 'message', timestamp, data: { role, content } }`
 */
export function appendMessage(sessionId, message) {
    const entry = {
        type: 'message',
        timestamp: Date.now(),
        data: {
            role: message.role,
            content: message.content,
        },
    };
    const filePath = getSessionFilePath(sessionId);
    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}
/**
 * Append a tool result entry to the session's JSONL file.
 */
export function appendToolResult(sessionId, toolUseId, toolName, result, isError) {
    const entry = {
        type: 'tool_result',
        timestamp: Date.now(),
        data: {
            toolUseId,
            toolName,
            result,
            isError,
        },
    };
    const filePath = getSessionFilePath(sessionId);
    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}
// ============================================================================
// Load
// ============================================================================
/**
 * Load a session from disk.
 *
 * Reads the JSONL file line by line, extracts metadata from the first entry,
 * reconstructs messages from message entries, and returns a SavedSession.
 * Returns null if the file doesn't exist or is unreadable.
 */
export function loadSession(sessionId) {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath))
        return null;
    let raw;
    try {
        raw = readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return null;
    let metadata = null;
    const messages = [];
    for (const line of lines) {
        let entry;
        try {
            entry = JSON.parse(line);
        }
        catch {
            continue; // skip malformed lines
        }
        if (entry.type === 'metadata' && !metadata) {
            metadata = entry.data;
        }
        else if (entry.type === 'message') {
            const role = entry.data.role;
            const content = entry.data.content;
            messages.push({ role, content });
        }
        // tool_result and system entries are informational — not converted
        // back to messages here (they supplement the message stream)
    }
    if (!metadata) {
        // File exists but has no metadata line; synthesize minimal metadata
        metadata = {
            id: sessionId,
            title: 'Untitled session',
            model: 'unknown',
            cwd: '',
            createdAt: 0,
            updatedAt: 0,
            messageCount: messages.length,
        };
    }
    return { metadata, messages };
}
// ============================================================================
// List
// ============================================================================
/**
 * List recent sessions.
 *
 * Reads all .jsonl files in the sessions dir, parses metadata from the
 * first line of each, sorts by updatedAt descending, and limits to `limit`
 * (default MAX_SESSIONS).
 */
export function listSessions(limit) {
    const dir = getSessionsDir();
    const effectiveLimit = limit ?? MAX_SESSIONS;
    let files;
    try {
        files = readdirSync(dir).filter((f) => f.endsWith(SESSION_EXT));
    }
    catch {
        return [];
    }
    const sessions = [];
    for (const file of files) {
        const filePath = join(dir, file);
        try {
            const raw = readFileSync(filePath, 'utf-8');
            const firstLine = raw.split('\n')[0];
            if (!firstLine)
                continue;
            const entry = JSON.parse(firstLine);
            if (entry.type === 'metadata' && entry.data) {
                sessions.push(entry.data);
            }
        }
        catch {
            // skip unreadable files
        }
    }
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions.slice(0, effectiveLimit);
}
// ============================================================================
// Delete & cleanup
// ============================================================================
/**
 * Delete a session file (and its markdown export if present).
 * Returns true if the JSONL file was deleted, false otherwise.
 */
export function deleteSession(sessionId) {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath))
        return false;
    try {
        unlinkSync(filePath);
    }
    catch {
        return false;
    }
    // Also remove markdown export if it exists
    const mdPath = getSessionMdPath(sessionId);
    if (existsSync(mdPath)) {
        try {
            unlinkSync(mdPath);
        }
        catch {
            // non-critical
        }
    }
    return true;
}
/**
 * Delete sessions older than MAX_SESSION_AGE_DAYS.
 * Returns the count of deleted sessions.
 */
export function cleanupOldSessions() {
    const threshold = Date.now() - MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    const sessions = listSessions(undefined);
    let deleted = 0;
    for (const session of sessions) {
        if (session.updatedAt < threshold) {
            if (deleteSession(session.id)) {
                deleted++;
            }
        }
    }
    return deleted;
}
// ============================================================================
// Markdown export
// ============================================================================
/**
 * Extract plain text from message content (string or ContentBlock[]).
 */
function extractText(content) {
    if (typeof content === 'string')
        return content;
    const parts = [];
    for (const block of content) {
        switch (block.type) {
            case 'text':
                parts.push(block.text);
                break;
            case 'thinking':
                parts.push(`<thinking>\n${block.thinking}\n</thinking>`);
                break;
            case 'tool_use':
                parts.push(`**Tool call:** \`${block.name}\`\n\`\`\`json\n${JSON.stringify(block.input, null, 2)}\n\`\`\``);
                break;
            case 'tool_result': {
                const resultText = typeof block.content === 'string'
                    ? block.content
                    : block.content.map((b) => extractText([b])).join('\n');
                const prefix = block.is_error ? '**Tool error:**' : '**Tool result:**';
                parts.push(`${prefix}\n\`\`\`\n${resultText}\n\`\`\``);
                break;
            }
            case 'image':
                parts.push('*[image]*');
                break;
        }
    }
    return parts.join('\n\n');
}
/**
 * Export a session as Markdown.
 *
 * Loads the session, formats it as readable Markdown with headers, role
 * labels, and fenced code blocks for tool results, then writes the .md
 * file alongside the .jsonl file.
 *
 * Returns the Markdown content, or null if the session cannot be loaded.
 */
export function exportSessionToMarkdown(sessionId) {
    const session = loadSession(sessionId);
    if (!session)
        return null;
    const { metadata, messages } = session;
    const lines = [];
    // Header
    lines.push(`# ${metadata.title}`);
    lines.push('');
    lines.push(`- **Session ID:** ${metadata.id}`);
    lines.push(`- **Model:** ${metadata.model}`);
    lines.push(`- **Working directory:** ${metadata.cwd}`);
    lines.push(`- **Created:** ${new Date(metadata.createdAt).toISOString()}`);
    lines.push(`- **Updated:** ${new Date(metadata.updatedAt).toISOString()}`);
    lines.push(`- **Messages:** ${metadata.messageCount}`);
    if (metadata.tokenCount !== undefined) {
        lines.push(`- **Tokens:** ${metadata.tokenCount.toLocaleString()}`);
    }
    if (metadata.costUSD !== undefined) {
        lines.push(`- **Cost:** $${metadata.costUSD.toFixed(4)}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    // Messages
    for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
        lines.push(`## ${roleLabel}`);
        lines.push('');
        lines.push(extractText(msg.content));
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    // Also read tool_result entries from the raw JSONL to include standalone results
    const filePath = getSessionFilePath(sessionId);
    if (existsSync(filePath)) {
        try {
            const raw = readFileSync(filePath, 'utf-8');
            const rawLines = raw.split('\n').filter((l) => l.trim().length > 0);
            const toolResults = [];
            for (const line of rawLines) {
                try {
                    const entry = JSON.parse(line);
                    if (entry.type === 'tool_result') {
                        toolResults.push(entry);
                    }
                }
                catch {
                    // skip
                }
            }
            if (toolResults.length > 0) {
                lines.push('## Tool Results');
                lines.push('');
                for (const tr of toolResults) {
                    const d = tr.data;
                    const errorFlag = d.isError ? ' (ERROR)' : '';
                    lines.push(`### \`${d.toolName}\`${errorFlag}`);
                    lines.push('');
                    lines.push(`- **Tool Use ID:** ${d.toolUseId}`);
                    lines.push(`- **Time:** ${new Date(tr.timestamp).toISOString()}`);
                    lines.push('');
                    lines.push('```');
                    lines.push(String(d.result));
                    lines.push('```');
                    lines.push('');
                }
            }
        }
        catch {
            // non-critical
        }
    }
    const markdown = lines.join('\n');
    const mdPath = getSessionMdPath(sessionId);
    writeFileSync(mdPath, markdown, 'utf-8');
    return markdown;
}
// ============================================================================
// Bulk save / update
// ============================================================================
/**
 * Bulk save/update a session.
 *
 * Rewrites the entire JSONL file with current state:
 * 1. Updated metadata (messageCount, updatedAt, tokenCount, costUSD)
 * 2. All messages as entries
 */
export function saveSessionState(sessionId, messages, metadata) {
    const filePath = getSessionFilePath(sessionId);
    const now = Date.now();
    // Load existing metadata or create minimal defaults
    let existingMetadata;
    const existingSession = loadSession(sessionId);
    if (existingSession) {
        existingMetadata = existingSession.metadata;
    }
    else {
        existingMetadata = {
            id: sessionId,
            title: 'Untitled session',
            model: 'unknown',
            cwd: '',
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
        };
    }
    // Merge updates
    const updatedMetadata = {
        ...existingMetadata,
        ...metadata,
        id: sessionId, // never allow id to change
        updatedAt: now,
        messageCount: messages.length,
        title: metadata.title ??
            (existingMetadata.title === 'Untitled session'
                ? generateSessionTitle(messages)
                : existingMetadata.title),
    };
    // Build lines
    const lines = [];
    // First line: metadata
    const metaEntry = {
        type: 'metadata',
        timestamp: now,
        data: updatedMetadata,
    };
    lines.push(JSON.stringify(metaEntry));
    // Subsequent lines: messages
    for (const msg of messages) {
        const msgEntry = {
            type: 'message',
            timestamp: now,
            data: {
                role: msg.role,
                content: msg.content,
            },
        };
        lines.push(JSON.stringify(msgEntry));
    }
    // Ensure the directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}
// ============================================================================
// Resume helpers
// ============================================================================
/**
 * Get titles of recent sessions for the resume picker.
 *
 * Returns an array of { id, title, date } objects sorted by most recent first.
 */
export function getRecentSessionTitles(limit) {
    const sessions = listSessions(limit ?? 20);
    return sessions.map((s) => ({
        id: s.id,
        title: s.title,
        date: new Date(s.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
    }));
}
/**
 * Search sessions by title (case-insensitive substring match).
 * Returns the first matching session's metadata, or null.
 */
export function findSessionByTitle(query) {
    const sessions = listSessions();
    const lowerQuery = query.toLowerCase();
    return sessions.find((s) => s.title.toLowerCase().includes(lowerQuery)) ?? null;
}
/**
 * Update only the metadata (first line) of a session's JSONL file.
 *
 * This is a lightweight alternative to saveSessionState() that preserves
 * all existing message entries and only rewrites the metadata line.
 */
export function updateSessionMetadata(sessionId, updates) {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath))
        return;
    let raw;
    try {
        raw = readFileSync(filePath, 'utf-8');
    }
    catch {
        return;
    }
    const lines = raw.split('\n');
    if (lines.length === 0)
        return;
    // Parse the first line (metadata)
    let entry;
    try {
        entry = JSON.parse(lines[0]);
    }
    catch {
        return;
    }
    if (entry.type !== 'metadata')
        return;
    // Merge updates into existing metadata
    const metadata = entry.data;
    Object.assign(metadata, updates, { updatedAt: Date.now() });
    // Rewrite only the first line
    lines[0] = JSON.stringify({ type: 'metadata', timestamp: Date.now(), data: metadata });
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
//# sourceMappingURL=session.js.map