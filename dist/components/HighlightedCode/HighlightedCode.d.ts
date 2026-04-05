import React from 'react';
export interface HighlightedCodeProps {
    code: string;
    filePath?: string;
    language?: string;
    dim?: boolean;
    maxLines?: number;
    showLineNumbers?: boolean;
    startLine?: number;
    highlightLines?: Set<number>;
}
export interface CodeBlockProps {
    code: string;
    language?: string;
    filePath?: string;
    title?: string;
    dim?: boolean;
    maxLines?: number;
}
export interface InlineCodeProps {
    code: string;
    color?: string;
}
interface Token {
    text: string;
    color?: string;
}
export declare function detectLanguage(filePath: string): string;
export declare function tokenizeLine(line: string, language: string): Token[];
export declare const HighlightedCode: React.FC<HighlightedCodeProps>;
export declare const CodeBlock: React.FC<CodeBlockProps>;
export declare const InlineCode: React.FC<InlineCodeProps>;
export default HighlightedCode;
//# sourceMappingURL=HighlightedCode.d.ts.map