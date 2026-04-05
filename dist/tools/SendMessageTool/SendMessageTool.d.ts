/**
 * SendMessageTool — Send a message to another agent or channel.
 *
 * Stores messages in appState.messages for inter-agent communication.
 * Auto-allowed (no permission prompt needed).
 */
import { z } from 'zod';
declare const SEND_MESSAGE_TOOL_NAME = "SendMessage";
export declare const SendMessageTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { SEND_MESSAGE_TOOL_NAME };
//# sourceMappingURL=SendMessageTool.d.ts.map