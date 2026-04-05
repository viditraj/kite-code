/**
 * MessageList — Re-exports from MessageRow for backward compatibility.
 *
 * The new REPL uses MessageRow directly with <Static>, but other code
 * may still import from this file.
 */
export { type DisplayMessage, MessageRow, MessageDivider, UserMessage, AssistantMessage, SystemMessage, ToolResultMessage, } from './MessageRow.js';
import React from 'react';
import { type DisplayMessage } from './MessageRow.js';
export interface MessageListProps {
    messages: DisplayMessage[];
}
export declare const MessageList: React.FC<MessageListProps>;
//# sourceMappingURL=MessageList.d.ts.map