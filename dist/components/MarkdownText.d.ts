/**
 * MarkdownText — Renders markdown-formatted text using Ink primitives.
 *
 * Parses basic markdown syntax and renders with appropriate Ink styles:
 * - **bold** → <Text bold>
 * - *italic* → <Text italic>
 * - `code` → <Text inverse> (highlighted inline code)
 * - ```code blocks``` → boxed code with language label
 * - - bullet lists → indented with bullet char
 * - [links](url) → shown as "text (url)"
 * - # headings → bold + underline
 */
import React from 'react';
export interface MarkdownTextProps {
    children: string;
}
/**
 * Render a string with basic markdown formatting.
 * Handles inline formatting and block-level elements.
 */
export declare const MarkdownText: React.FC<MarkdownTextProps>;
export default MarkdownText;
//# sourceMappingURL=MarkdownText.d.ts.map