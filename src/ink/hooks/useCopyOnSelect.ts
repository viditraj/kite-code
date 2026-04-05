/**
 * useCopyOnSelect — auto-copy selected text to clipboard.
 *
 * Adapted from Claude Code's useCopyOnSelect.ts for Kite.
 * Monitors a selection state and copies text to the system clipboard
 * when a selection completes (mouse-up with non-empty selection).
 *
 * In terminal environments, this provides a clipboard bridge since
 * Cmd/Ctrl+C is intercepted by the terminal for SIGINT.
 */

import { useCallback, useRef } from 'react'
import { execSync } from 'child_process'

export interface SelectionState {
  text: string
  isDragging: boolean
  hasSelection: boolean
}

/**
 * Copy text to the system clipboard.
 * Returns true on success, false on failure.
 */
function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform
    if (platform === 'darwin') {
      execSync('pbcopy', { input: text, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      return true
    } else if (platform === 'linux') {
      try {
        execSync('xclip -selection clipboard', { input: text, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        return true
      } catch {
        try {
          execSync('xsel --clipboard --input', { input: text, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
          return true
        } catch {
          return false
        }
      }
    } else if (platform === 'win32') {
      execSync('clip', { input: text, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Hook that copies text to clipboard when selection completes.
 *
 * @param isActive - Whether to listen for selection changes
 * @param onCopied - Optional callback when text is copied
 * @returns Object with handleSelectionChange function
 */
export function useCopyOnSelect(
  isActive: boolean,
  onCopied?: (text: string) => void,
): {
  handleSelectionChange: (state: SelectionState) => void
  copyText: (text: string) => boolean
} {
  const copiedRef = useRef(false)
  const onCopiedRef = useRef(onCopied)
  onCopiedRef.current = onCopied

  const handleSelectionChange = useCallback(
    (state: SelectionState) => {
      if (!isActive) return

      // Drag in progress — wait for finish
      if (state.isDragging) {
        copiedRef.current = false
        return
      }

      // No selection — reset
      if (!state.hasSelection) {
        copiedRef.current = false
        return
      }

      // Already copied this selection
      if (copiedRef.current) return

      const text = state.text
      if (!text || !text.trim()) {
        copiedRef.current = true
        return
      }

      // Copy to clipboard
      const success = copyToClipboard(text)
      copiedRef.current = true

      if (success) {
        onCopiedRef.current?.(text)
      }
    },
    [isActive],
  )

  return {
    handleSelectionChange,
    copyText: copyToClipboard,
  }
}
