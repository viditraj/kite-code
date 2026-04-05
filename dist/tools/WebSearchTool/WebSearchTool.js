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
import { buildTool } from '../../Tool.js';
// ============================================================================
// Constants
// ============================================================================
export const WEB_SEARCH_TOOL_NAME = 'WebSearch';
const MAX_RESULTS = 10;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// ============================================================================
// Schema
// ============================================================================
const inputSchema = z.strictObject({
    query: z.string().min(2).describe('The search query to use'),
    allowed_domains: z.array(z.string()).optional().describe('Only include search results from these domains'),
    blocked_domains: z.array(z.string()).optional().describe('Never include search results from these domains'),
});
// ============================================================================
// DuckDuckGo HTML search
// ============================================================================
/**
 * Fetch search results from DuckDuckGo's HTML endpoint.
 * This is the lite/HTML version that doesn't require JS execution.
 */
async function searchDuckDuckGo(query, signal) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        signal,
        redirect: 'follow',
    });
    if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
    }
    const html = await response.text();
    return parseSearchResults(html);
}
/**
 * Parse DuckDuckGo HTML search results page.
 * Extracts titles, URLs, and snippets from the result divs.
 */
function parseSearchResults(html) {
    const results = [];
    // DuckDuckGo HTML results are in <div class="result"> elements
    // Each result has:
    //   <a class="result__a" href="...">title</a>
    //   <a class="result__snippet">snippet text</a>
    // or
    //   <a class="result__url" href="...">url</a>
    // Match result blocks
    const resultBlockPattern = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
    const blocks = html.match(resultBlockPattern) || [];
    // Fallback: try individual link+snippet extraction if block matching fails
    if (blocks.length === 0) {
        // Try a more lenient pattern for result links
        const linkPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        const links = [];
        let linkMatch;
        while ((linkMatch = linkPattern.exec(html)) !== null) {
            links.push({
                url: decodeURIComponent(linkMatch[1].replace(/.*uddg=/, '').replace(/&.*/, '')),
                title: stripHtmlTags(linkMatch[2]),
            });
        }
        const snippets = [];
        let snippetMatch;
        while ((snippetMatch = snippetPattern.exec(html)) !== null) {
            snippets.push(stripHtmlTags(snippetMatch[1]));
        }
        for (let i = 0; i < links.length && i < MAX_RESULTS; i++) {
            const link = links[i];
            if (link.url && link.title && !link.url.startsWith('/') && link.url.startsWith('http')) {
                results.push({
                    title: link.title,
                    url: link.url,
                    snippet: snippets[i] ?? '',
                });
            }
        }
        return results;
    }
    for (const block of blocks) {
        if (results.length >= MAX_RESULTS)
            break;
        // Extract URL from result__a href
        const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"/);
        // Extract title from result__a inner text
        const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
        // Extract snippet
        const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        if (urlMatch && titleMatch) {
            // DuckDuckGo wraps URLs through a redirect — extract the actual URL
            let url = urlMatch[1];
            const uddgMatch = url.match(/uddg=([^&]+)/);
            if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1]);
            }
            if (url.startsWith('http')) {
                results.push({
                    title: stripHtmlTags(titleMatch[1]).trim(),
                    url,
                    snippet: snippetMatch ? stripHtmlTags(snippetMatch[1]).trim() : '',
                });
            }
        }
    }
    return results;
}
/** Strip HTML tags and decode common entities */
function stripHtmlTags(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Filter results by allowed/blocked domain lists.
 */
function filterByDomains(results, allowedDomains, blockedDomains) {
    return results.filter(r => {
        let hostname;
        try {
            hostname = new URL(r.url).hostname;
        }
        catch {
            return false;
        }
        if (allowedDomains && allowedDomains.length > 0) {
            return allowedDomains.some(d => hostname.endsWith(d));
        }
        if (blockedDomains && blockedDomains.length > 0) {
            return !blockedDomains.some(d => hostname.endsWith(d));
        }
        return true;
    });
}
// ============================================================================
// Tool definition
// ============================================================================
export const WebSearchTool = buildTool({
    name: WEB_SEARCH_TOOL_NAME,
    searchHint: 'search the web for current information',
    maxResultSizeChars: 100_000,
    shouldDefer: true,
    strict: true,
    inputSchema,
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    async description(input) {
        return `Search the web for: ${input.query}`;
    },
    async prompt() {
        const now = new Date();
        const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return `Search the web for current information using DuckDuckGo. Returns search results with titles, URLs, and snippets.

Current date: ${monthYear}

CRITICAL: You MUST include sources in your response using markdown hyperlinks [title](url).

Parameters:
- query: The search query (be specific for better results)
- allowed_domains: Optional array to restrict results to specific domains
- blocked_domains: Optional array to exclude results from specific domains
  (You cannot specify both allowed_domains and blocked_domains)

Tips:
- Include the current year in queries about recent events
- Use specific technical terms for programming questions
- Use domain filters to focus on authoritative sources`;
    },
    async validateInput(input) {
        if (input.allowed_domains && input.blocked_domains) {
            return {
                result: false,
                message: 'Cannot specify both allowed_domains and blocked_domains',
            };
        }
        return { result: true };
    },
    async checkPermissions(input) {
        return { behavior: 'allow' };
    },
    async call({ query, allowed_domains, blocked_domains }, context, _canUseTool, _parentMessage, onProgress) {
        const startTime = Date.now();
        // Emit progress: starting search
        if (onProgress) {
            onProgress({
                toolUseID: 'search-progress-0',
                data: { type: 'query_update', query },
            });
        }
        let results;
        try {
            // Perform the actual DuckDuckGo search
            const abortTimeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
            const signal = context.abortController.signal.aborted
                ? AbortSignal.abort()
                : AbortSignal.any
                    ? AbortSignal.any([context.abortController.signal, abortTimeout])
                    : abortTimeout;
            results = await searchDuckDuckGo(query, signal);
        }
        catch (err) {
            const durationSeconds = (Date.now() - startTime) / 1000;
            return {
                data: {
                    query,
                    results: [`Web search error: ${err.message}`],
                    durationSeconds,
                },
            };
        }
        // Apply domain filtering
        results = filterByDomains(results, allowed_domains, blocked_domains);
        // Emit progress: results received
        if (onProgress) {
            onProgress({
                toolUseID: 'search-progress-1',
                data: { type: 'search_results_received', resultCount: results.length, query },
            });
        }
        const durationSeconds = (Date.now() - startTime) / 1000;
        return {
            data: {
                query,
                results: results.length > 0
                    ? results
                    : [`No search results found for: "${query}". Try a different query.`],
                durationSeconds,
            },
        };
    },
    mapToolResultToToolResultBlockParam(data, toolUseID) {
        let formattedOutput = `Web search results for query: "${data.query}"\n`;
        formattedOutput += `Found ${data.results.filter(r => typeof r !== 'string').length} results in ${data.durationSeconds.toFixed(1)}s\n\n`;
        for (const result of data.results) {
            if (typeof result === 'string') {
                formattedOutput += result + '\n\n';
            }
            else {
                formattedOutput += `- [${result.title}](${result.url})`;
                if (result.snippet) {
                    formattedOutput += `\n  ${result.snippet}`;
                }
                formattedOutput += '\n\n';
            }
        }
        formattedOutput += '\nREMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.';
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: formattedOutput.trim(),
        };
    },
});
//# sourceMappingURL=WebSearchTool.js.map