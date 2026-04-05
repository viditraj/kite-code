/**
 * WebSearchTool — Search the web for current information.
 *
 * Uses DuckDuckGo HTML search (no API key required) to perform real web
 * searches. This is the provider-agnostic approach — Claude Code uses
 * Anthropic's server-side web_search_20250305 tool, but since Kite supports
 * any LLM provider, we need a standalone search implementation.
 *
 * Flow:
 * 1. Fetch DuckDuckGo HTML results for the query
 * 2. Parse titles, URLs, and snippets from the HTML
 * 3. Apply domain filtering (allowed/blocked)
 * 4. Return structured results
 */
import { z } from 'zod';
export declare const WEB_SEARCH_TOOL_NAME = "WebSearch";
export declare const WebSearchTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
//# sourceMappingURL=WebSearchTool.d.ts.map