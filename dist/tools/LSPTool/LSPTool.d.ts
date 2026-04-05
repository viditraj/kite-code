/**
 * LSPTool — Language Server Protocol integration for code intelligence.
 *
 * Provides static analysis diagnostics by running the appropriate linter
 * based on file extension, plus stub messages for full LSP features that
 * require a running language server.
 *
 * Supported linters:
 * - TypeScript/TSX: `npx tsc --noEmit`
 * - Python: `python3 -m py_compile`
 * - JavaScript/JSX: `node --check`
 * - Rust: `cargo check --message-format=json`
 */
import { z } from 'zod';
declare const LSP_TOOL_NAME = "LSP";
export declare const LSPTool: import("../../Tool.js").Tool<z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>, unknown>;
export { LSP_TOOL_NAME };
//# sourceMappingURL=LSPTool.d.ts.map