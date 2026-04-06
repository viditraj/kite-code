/**
 * Screenshot clipboard — copy ANSI-rendered images to system clipboard.
 *
 * Based on Claude Code's utils/screenshotClipboard.ts.
 * Pipeline: ANSI text → ansiToPng() → temp file → platform clipboard copy.
 *
 * Supports macOS (osascript), Linux (xclip/xsel), and Windows (PowerShell).
 */

import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'
import { ansiToPng, type AnsiToPngOptions } from './ansiToPng.js'

const SCREENSHOT_DIR = join(tmpdir(), 'kite-screenshots')
const CLIPBOARD_TIMEOUT = 5000

export interface ClipboardResult {
  success: boolean
  message: string
}

/**
 * Render ANSI text to PNG and copy it to the system clipboard.
 */
export function copyAnsiToClipboard(
  ansiText: string,
  options?: AnsiToPngOptions,
): ClipboardResult {
  try {
    // Render to PNG
    const pngBuffer = ansiToPng(ansiText, options)

    // Write to temp file
    if (!existsSync(SCREENSHOT_DIR)) {
      mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
    const tempPath = join(SCREENSHOT_DIR, `screenshot-${Date.now()}.png`)
    writeFileSync(tempPath, pngBuffer)

    try {
      // Copy to clipboard based on platform
      const result = copyFileToClipboard(tempPath)
      return result
    } finally {
      // Clean up temp file
      try { unlinkSync(tempPath) } catch {}
    }
  } catch (err) {
    return {
      success: false,
      message: `Screenshot failed: ${(err as Error).message}`,
    }
  }
}

/**
 * Save ANSI text as a PNG file.
 */
export function saveAnsiAsPng(
  ansiText: string,
  outputPath: string,
  options?: AnsiToPngOptions,
): { success: boolean; message: string; bytes: number } {
  try {
    const pngBuffer = ansiToPng(ansiText, options)
    writeFileSync(outputPath, pngBuffer)
    return { success: true, message: `Saved to ${outputPath}`, bytes: pngBuffer.length }
  } catch (err) {
    return { success: false, message: `Save failed: ${(err as Error).message}`, bytes: 0 }
  }
}

/**
 * Copy a PNG file to the system clipboard.
 */
function copyFileToClipboard(pngPath: string): ClipboardResult {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      return copyToClipboardMacOS(pngPath)
    } else if (platform === 'linux') {
      return copyToClipboardLinux(pngPath)
    } else if (platform === 'win32') {
      return copyToClipboardWindows(pngPath)
    } else {
      return { success: false, message: `Clipboard not supported on ${platform}` }
    }
  } catch (err) {
    return { success: false, message: `Clipboard copy failed: ${(err as Error).message}` }
  }
}

/** macOS: Use osascript to copy PNG via AppleScript */
function copyToClipboardMacOS(pngPath: string): ClipboardResult {
  const escapedPath = pngPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = `set the clipboard to (read (POSIX file "${escapedPath}") as «class PNGf»)`

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: CLIPBOARD_TIMEOUT,
      stdio: 'pipe',
    })
    return { success: true, message: 'Copied to clipboard' }
  } catch {
    return { success: false, message: 'osascript clipboard copy failed' }
  }
}

/** Linux: Try xclip first, fall back to xsel */
function copyToClipboardLinux(pngPath: string): ClipboardResult {
  // Try xclip
  try {
    execSync(`xclip -selection clipboard -t image/png -i "${pngPath}"`, {
      timeout: CLIPBOARD_TIMEOUT,
      stdio: 'pipe',
    })
    return { success: true, message: 'Copied to clipboard (xclip)' }
  } catch {
    // xclip not available
  }

  // Try xsel
  try {
    execSync(`xsel --clipboard --input --type image/png < "${pngPath}"`, {
      timeout: CLIPBOARD_TIMEOUT,
      stdio: 'pipe',
      shell: '/bin/bash',
    })
    return { success: true, message: 'Copied to clipboard (xsel)' }
  } catch {
    // xsel not available either
  }

  return { success: false, message: 'No clipboard tool found (install xclip or xsel)' }
}

/** Windows: Use PowerShell with .NET Clipboard API */
function copyToClipboardWindows(pngPath: string): ClipboardResult {
  const escapedPath = pngPath.replace(/'/g, "''")
  const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${escapedPath}'))`

  try {
    execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, {
      timeout: CLIPBOARD_TIMEOUT,
      stdio: 'pipe',
    })
    return { success: true, message: 'Copied to clipboard' }
  } catch {
    return { success: false, message: 'PowerShell clipboard copy failed' }
  }
}
