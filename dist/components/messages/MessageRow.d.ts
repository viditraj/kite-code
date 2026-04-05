/**
 * MessageRow — Rich message rendering for the REPL.
 *
 * Each message type gets distinct visual treatment:
 * - User messages: green prefix, plain text
 * - Assistant messages: gradient-styled prefix, markdown rendering
 * - System messages: yellow with icon
 * - Tool results: cyan with type-specific formatting (file changes, bash output, etc.)
 */
import React from 'react';
export interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool_result';
    content: string;
    toolName?: string;
    toolUseId?: string;
    isError?: boolean;
    isThinking?: boolean;
    timestamp?: number;
}
export declare const UserMessage: React.FC<{
    content: string;
    timestamp?: number;
}>;
export declare const AssistantMessage: React.FC<{
    content: string;
    isThinking?: boolean;
    timestamp?: number;
}>;
export declare const SystemMessage: React.FC<{
    content: string;
}>;
export declare const ToolResultMessage: React.FC<{
    toolName: string;
    content: string;
    isError?: boolean;
}>;
export declare const MessageRow: React.FC<{
    message: DisplayMessage;
}>;
export declare const MessageDivider: React.FC<{
    width?: number;
}>;
//# sourceMappingURL=MessageRow.d.ts.map