/**
 * State persistence — save/load AppState to disk.
 *
 * Persists user preferences (theme, vim mode, output style, etc.)
 * to ~/.kite/state.json. Only a subset of the state is persisted —
 * runtime-only fields (provider, session, tokens) are excluded.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { AppState, OutputStyle, EffortLevel } from './AppStateStore.js'

// ============================================================================
// Constants
// ============================================================================

const STATE_DIR = '.kite'
const STATE_FILE = 'state.json'

// ============================================================================
// Types
// ============================================================================

/** Subset of AppState that is persisted to disk. */
export interface PersistedState {
  vimMode: boolean
  showThinking: boolean
  fastMode: boolean
  outputStyle: OutputStyle
  effortLevel: EffortLevel
  theme: string
}

// ============================================================================
// Persistence
// ============================================================================

function getStatePath(): string {
  return join(homedir(), STATE_DIR, STATE_FILE)
}

/**
 * Load persisted state from disk.
 * Returns partial AppState overrides, or an empty object if no state file exists.
 */
export function loadPersistedState(): Partial<AppState> {
  const filePath = getStatePath()
  if (!existsSync(filePath)) return {}

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedState>

    const result: Partial<AppState> = {}

    if (typeof parsed.vimMode === 'boolean') result.vimMode = parsed.vimMode
    if (typeof parsed.showThinking === 'boolean') result.showThinking = parsed.showThinking
    if (typeof parsed.fastMode === 'boolean') result.fastMode = parsed.fastMode
    if (typeof parsed.outputStyle === 'string' && ['verbose', 'concise', 'brief'].includes(parsed.outputStyle)) {
      result.outputStyle = parsed.outputStyle as OutputStyle
    }
    if (typeof parsed.effortLevel === 'string' && ['low', 'medium', 'high'].includes(parsed.effortLevel)) {
      result.effortLevel = parsed.effortLevel as EffortLevel
    }
    if (typeof parsed.theme === 'string') result.theme = parsed.theme

    return result
  } catch {
    return {}
  }
}

/**
 * Save the persisted subset of AppState to disk.
 * Creates the ~/.kite directory if it doesn't exist.
 */
export function savePersistedState(state: AppState): void {
  const filePath = getStatePath()
  const dir = join(homedir(), STATE_DIR)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const persisted: PersistedState = {
    vimMode: state.vimMode,
    showThinking: state.showThinking,
    fastMode: state.fastMode,
    outputStyle: state.outputStyle,
    effortLevel: state.effortLevel,
    theme: state.theme,
  }

  try {
    writeFileSync(filePath, JSON.stringify(persisted, null, 2) + '\n', 'utf-8')
  } catch {
    // Non-critical — state will reset on next launch
  }
}

/**
 * Create an onChange handler that auto-persists state changes.
 * Debounces writes to avoid excessive disk I/O.
 */
export function createAutoSaveHandler(): (state: AppState) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 2000

  return (state: AppState) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      savePersistedState(state)
      timer = null
    }, DEBOUNCE_MS)
  }
}
