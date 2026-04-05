/**
 * CodeBlock — Renders a fenced code block with optional language label
 * and line numbers.
 *
 * Displays code inside a bordered Box, with dimmed line numbers on the
 * left and a language tag in the top-right corner.
 */
import React from 'react';
export interface CodeBlockProps {
    /** The source code to display. */
    code: string;
    /** Optional language identifier shown in the top-right corner. */
    language?: string;
    /** Whether to render line numbers. Defaults to true. */
    showLineNumbers?: boolean;
}
export declare function CodeBlock({ code, language, showLineNumbers, }: CodeBlockProps): React.ReactElement;
//# sourceMappingURL=CodeBlock.d.ts.map