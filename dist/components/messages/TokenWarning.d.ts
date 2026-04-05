/**
 * TokenWarning — Context limit warning banner.
 *
 * Displays a warning bar when context usage exceeds 80%.
 * Yellow at 80%, red at 95%. Shows percentage and token counts.
 */
import React from 'react';
export interface TokenWarningProps {
    percentUsed: number;
    maxTokens: number;
}
export declare const TokenWarning: React.FC<TokenWarningProps>;
export default TokenWarning;
//# sourceMappingURL=TokenWarning.d.ts.map