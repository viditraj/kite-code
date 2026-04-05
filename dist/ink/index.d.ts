/**
 * Kite Ink layer — re-exports from upstream ink + custom extensions.
 *
 * Uses the upstream `ink` package for the React terminal renderer,
 * re-exporting its primitives and adding Kite-specific wrappers.
 *
 * This module is the single import point for all UI code:
 *   import { Box, Text, render, useInput, useApp } from '../ink/index.js'
 */
export { render, Box, Text, Newline, Spacer, Static, Transform, useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager, measureElement, } from 'ink';
export type { Instance as InkInstance, RenderOptions, DOMElement, } from 'ink';
export { default as React } from 'react';
export { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext, type ReactNode, type FC, } from 'react';
export { useInterval } from './hooks/useInterval.js';
export { useTerminalSize } from './hooks/useTerminalSize.js';
export { useVimMode } from './hooks/useVimMode.js';
export { useKeybindings } from './hooks/useKeybindings.js';
export { useElapsedTime, formatDuration } from './hooks/useElapsedTime.js';
export { useTimeout } from './hooks/useTimeout.js';
export { useAfterFirstRender } from './hooks/useAfterFirstRender.js';
export { useMemoryUsage, type MemoryUsageInfo, type MemoryUsageStatus } from './hooks/useMemoryUsage.js';
export { useDoublePress, DOUBLE_PRESS_TIMEOUT_MS } from './hooks/useDoublePress.js';
export { useMinDisplayTime } from './hooks/useMinDisplayTime.js';
export { useCopyOnSelect, type SelectionState } from './hooks/useCopyOnSelect.js';
export { usePasteHandler, type PasteHandlerOptions, type PasteState } from './hooks/usePasteHandler.js';
export { useCancelRequest, type CancelRequestOptions, type CancelRequestResult } from './hooks/useCancelRequest.js';
export { useHistorySearch, type HistoryEntry, type UseHistorySearchOptions, type UseHistorySearchResult } from './hooks/useHistorySearch.js';
//# sourceMappingURL=index.d.ts.map