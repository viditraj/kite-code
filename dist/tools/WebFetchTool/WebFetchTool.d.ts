/**
 * WebFetchTool — Fetch content from URLs.
 *
 * Implements the same patterns as Claude Code's WebFetchTool.ts:
 * - HTTP GET with streaming response
 * - URL validation (scheme, credentials, hostname)
 * - HTTP→HTTPS upgrade
 * - Response size limits
 * - Basic HTML→text conversion
 * - Always read-only, concurrency-safe, deferred
 */
import { z } from 'zod';
declare const WEB_FETCH_TOOL_NAME = "WebFetch";
export declare const WebFetchTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { WEB_FETCH_TOOL_NAME };
//# sourceMappingURL=WebFetchTool.d.ts.map