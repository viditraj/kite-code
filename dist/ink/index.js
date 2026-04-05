/**
 * Kite Ink layer — re-exports from upstream ink + custom extensions.
 *
 * Uses the upstream `ink` package for the React terminal renderer,
 * re-exporting its primitives and adding Kite-specific wrappers.
 *
 * This module is the single import point for all UI code:
 *   import { Box, Text, render, useInput, useApp } from '../ink/index.js'
 */
// Re-export core ink primitives
export { render, Box, Text, Newline, Spacer, Static, Transform, useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager, measureElement, } from 'ink';
// Re-export React for convenience (JSX consumers need it)
export { default as React } from 'react';
export { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext, } from 'react';
// Re-export Kite hooks
export { useInterval } from './hooks/useInterval.js';
export { useTerminalSize } from './hooks/useTerminalSize.js';
export { useVimMode } from './hooks/useVimMode.js';
export { useKeybindings } from './hooks/useKeybindings.js';
export { useElapsedTime, formatDuration } from './hooks/useElapsedTime.js';
export { useTimeout } from './hooks/useTimeout.js';
export { useAfterFirstRender } from './hooks/useAfterFirstRender.js';
export { useMemoryUsage } from './hooks/useMemoryUsage.js';
export { useDoublePress, DOUBLE_PRESS_TIMEOUT_MS } from './hooks/useDoublePress.js';
export { useMinDisplayTime } from './hooks/useMinDisplayTime.js';
export { useCopyOnSelect } from './hooks/useCopyOnSelect.js';
export { usePasteHandler } from './hooks/usePasteHandler.js';
export { useCancelRequest } from './hooks/useCancelRequest.js';
export { useHistorySearch } from './hooks/useHistorySearch.js';
//# sourceMappingURL=index.js.map