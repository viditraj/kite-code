import { jsx as _jsx } from "react/jsx-runtime";
/**
 * MessageList — Re-exports from MessageRow for backward compatibility.
 *
 * The new REPL uses MessageRow directly with <Static>, but other code
 * may still import from this file.
 */
export { MessageRow, MessageDivider, UserMessage, AssistantMessage, SystemMessage, ToolResultMessage, } from './MessageRow.js';
import { Box } from 'ink';
import { MessageRow } from './MessageRow.js';
export const MessageList = ({ messages }) => {
    return (_jsx(Box, { flexDirection: "column", children: messages.map((message, index) => (_jsx(Box, { flexDirection: "column", paddingBottom: index < messages.length - 1 ? 1 : 0, children: _jsx(MessageRow, { message: message }) }, message.id))) }));
};
//# sourceMappingURL=MessageList.js.map