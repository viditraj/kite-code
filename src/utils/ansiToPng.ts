/**
 * ANSI terminal text → PNG conversion.
 *
 * Based on Claude Code's utils/ansiToPng.ts.
 * Pure TypeScript PNG renderer — zero external WASM or system font dependencies.
 *
 * Uses a built-in bitmap font (simple 8×16 pixel glyphs generated at startup)
 * and renders directly to an RGBA pixel buffer, then encodes as PNG using
 * Node.js built-in zlib.
 *
 * Performance: ~5-15ms per render.
 */

import { deflateSync } from 'zlib'
import { parseAnsi, type RGB } from './ansiToSvg.js'

// ============================================================================
// Constants
// ============================================================================

/** Glyph dimensions in pixels (high-res: 2x the 8×16 base) */
const GLYPH_W = 16
const GLYPH_H = 32

// ============================================================================
// Built-in bitmap font (16×32 monospace with anti-aliasing)
//
// Generated at startup by upscaling a classic 8×16 VGA font to 16×32
// with edge-smoothing for simulated anti-aliasing. Each glyph is a
// 16×32 grid of alpha values (0-255).
// ============================================================================

const FONT = new Map<number, Uint8Array>()

/** Generate a fallback glyph: dotted box outline */
function makeFallbackGlyph(): Uint8Array {
  const g = new Uint8Array(GLYPH_W * GLYPH_H)
  for (let x = 0; x < GLYPH_W; x++) {
    for (let y = 0; y < GLYPH_H; y++) {
      const isEdge = x === 0 || x === GLYPH_W - 1 || y === 0 || y === GLYPH_H - 1
      if (isEdge && ((x + y) % 2 === 0)) g[y * GLYPH_W + x] = 128
    }
  }
  return g
}

const FALLBACK_GLYPH = makeFallbackGlyph()

/**
 * Simple 8×16 bitmap font covering printable ASCII.
 * Each character is defined as an array of 16 rows, where each row is
 * an 8-bit bitmask (MSB = leftmost pixel).
 *
 * This is a basic font for terminal rendering — readable but not fancy.
 */
const FONT_DATA: Record<number, number[]> = {
  // Space
  0x20: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // !
  0x21: [0,0,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0,0x18,0x18,0,0,0,0],
  // "
  0x22: [0,0x66,0x66,0x66,0x24,0,0,0,0,0,0,0,0,0,0,0],
  // #
  0x23: [0,0,0x6C,0x6C,0xFE,0x6C,0x6C,0x6C,0xFE,0x6C,0x6C,0,0,0,0,0],
  // $
  0x24: [0x18,0x18,0x7C,0xC6,0xC0,0x7C,0x06,0xC6,0x7C,0x18,0x18,0,0,0,0,0],
  // %
  0x25: [0,0,0xC6,0xC6,0x0C,0x18,0x30,0x60,0xC6,0xC6,0,0,0,0,0,0],
  // &
  0x26: [0,0,0x38,0x6C,0x38,0x76,0xDC,0xCC,0x76,0,0,0,0,0,0,0],
  // '
  0x27: [0,0x18,0x18,0x18,0x30,0,0,0,0,0,0,0,0,0,0,0],
  // (
  0x28: [0,0,0x0C,0x18,0x30,0x30,0x30,0x30,0x18,0x0C,0,0,0,0,0,0],
  // )
  0x29: [0,0,0x30,0x18,0x0C,0x0C,0x0C,0x0C,0x18,0x30,0,0,0,0,0,0],
  // *
  0x2A: [0,0,0,0x66,0x3C,0xFF,0x3C,0x66,0,0,0,0,0,0,0,0],
  // +
  0x2B: [0,0,0,0x18,0x18,0x7E,0x18,0x18,0,0,0,0,0,0,0,0],
  // ,
  0x2C: [0,0,0,0,0,0,0,0,0x18,0x18,0x30,0,0,0,0,0],
  // -
  0x2D: [0,0,0,0,0,0xFE,0,0,0,0,0,0,0,0,0,0],
  // .
  0x2E: [0,0,0,0,0,0,0,0,0x18,0x18,0,0,0,0,0,0],
  // /
  0x2F: [0,0,0x06,0x0C,0x18,0x30,0x60,0xC0,0x80,0,0,0,0,0,0,0],
  // 0-9
  0x30: [0,0,0x7C,0xC6,0xCE,0xDE,0xF6,0xE6,0xC6,0x7C,0,0,0,0,0,0],
  0x31: [0,0,0x18,0x38,0x78,0x18,0x18,0x18,0x18,0x7E,0,0,0,0,0,0],
  0x32: [0,0,0x7C,0xC6,0x06,0x0C,0x18,0x30,0x60,0xFE,0,0,0,0,0,0],
  0x33: [0,0,0x7C,0xC6,0x06,0x3C,0x06,0x06,0xC6,0x7C,0,0,0,0,0,0],
  0x34: [0,0,0x0C,0x1C,0x3C,0x6C,0xCC,0xFE,0x0C,0x0C,0,0,0,0,0,0],
  0x35: [0,0,0xFE,0xC0,0xC0,0xFC,0x06,0x06,0xC6,0x7C,0,0,0,0,0,0],
  0x36: [0,0,0x3C,0x60,0xC0,0xFC,0xC6,0xC6,0xC6,0x7C,0,0,0,0,0,0],
  0x37: [0,0,0xFE,0xC6,0x06,0x0C,0x18,0x30,0x30,0x30,0,0,0,0,0,0],
  0x38: [0,0,0x7C,0xC6,0xC6,0x7C,0xC6,0xC6,0xC6,0x7C,0,0,0,0,0,0],
  0x39: [0,0,0x7C,0xC6,0xC6,0x7E,0x06,0x06,0x0C,0x78,0,0,0,0,0,0],
  // :
  0x3A: [0,0,0,0x18,0x18,0,0,0x18,0x18,0,0,0,0,0,0,0],
  // ;
  0x3B: [0,0,0,0x18,0x18,0,0,0x18,0x18,0x30,0,0,0,0,0,0],
  // <
  0x3C: [0,0,0x06,0x0C,0x18,0x30,0x18,0x0C,0x06,0,0,0,0,0,0,0],
  // =
  0x3D: [0,0,0,0,0x7E,0,0x7E,0,0,0,0,0,0,0,0,0],
  // >
  0x3E: [0,0,0x60,0x30,0x18,0x0C,0x18,0x30,0x60,0,0,0,0,0,0,0],
  // ?
  0x3F: [0,0,0x7C,0xC6,0x0C,0x18,0x18,0,0x18,0x18,0,0,0,0,0,0],
  // @
  0x40: [0,0,0x7C,0xC6,0xDE,0xDE,0xDE,0xDC,0xC0,0x7E,0,0,0,0,0,0],
  // A-Z
  0x41: [0,0,0x10,0x38,0x6C,0xC6,0xC6,0xFE,0xC6,0xC6,0,0,0,0,0,0],
  0x42: [0,0,0xFC,0x66,0x66,0x7C,0x66,0x66,0x66,0xFC,0,0,0,0,0,0],
  0x43: [0,0,0x3C,0x66,0xC0,0xC0,0xC0,0xC0,0x66,0x3C,0,0,0,0,0,0],
  0x44: [0,0,0xF8,0x6C,0x66,0x66,0x66,0x66,0x6C,0xF8,0,0,0,0,0,0],
  0x45: [0,0,0xFE,0x62,0x68,0x78,0x68,0x60,0x62,0xFE,0,0,0,0,0,0],
  0x46: [0,0,0xFE,0x62,0x68,0x78,0x68,0x60,0x60,0xF0,0,0,0,0,0,0],
  0x47: [0,0,0x3C,0x66,0xC0,0xC0,0xCE,0xC6,0x66,0x3E,0,0,0,0,0,0],
  0x48: [0,0,0xC6,0xC6,0xC6,0xFE,0xC6,0xC6,0xC6,0xC6,0,0,0,0,0,0],
  0x49: [0,0,0x3C,0x18,0x18,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0],
  0x4A: [0,0,0x1E,0x0C,0x0C,0x0C,0x0C,0xCC,0xCC,0x78,0,0,0,0,0,0],
  0x4B: [0,0,0xE6,0x66,0x6C,0x78,0x78,0x6C,0x66,0xE6,0,0,0,0,0,0],
  0x4C: [0,0,0xF0,0x60,0x60,0x60,0x60,0x60,0x62,0xFE,0,0,0,0,0,0],
  0x4D: [0,0,0xC6,0xEE,0xFE,0xD6,0xC6,0xC6,0xC6,0xC6,0,0,0,0,0,0],
  0x4E: [0,0,0xC6,0xE6,0xF6,0xDE,0xCE,0xC6,0xC6,0xC6,0,0,0,0,0,0],
  0x4F: [0,0,0x7C,0xC6,0xC6,0xC6,0xC6,0xC6,0xC6,0x7C,0,0,0,0,0,0],
  0x50: [0,0,0xFC,0x66,0x66,0x7C,0x60,0x60,0x60,0xF0,0,0,0,0,0,0],
  0x51: [0,0,0x7C,0xC6,0xC6,0xC6,0xC6,0xD6,0xDE,0x7C,0x0E,0,0,0,0,0],
  0x52: [0,0,0xFC,0x66,0x66,0x7C,0x6C,0x66,0x66,0xE6,0,0,0,0,0,0],
  0x53: [0,0,0x7C,0xC6,0xC0,0x7C,0x06,0x06,0xC6,0x7C,0,0,0,0,0,0],
  0x54: [0,0,0x7E,0x5A,0x18,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0],
  0x55: [0,0,0xC6,0xC6,0xC6,0xC6,0xC6,0xC6,0xC6,0x7C,0,0,0,0,0,0],
  0x56: [0,0,0xC6,0xC6,0xC6,0xC6,0x6C,0x38,0x10,0x10,0,0,0,0,0,0],
  0x57: [0,0,0xC6,0xC6,0xC6,0xD6,0xFE,0xEE,0xC6,0xC6,0,0,0,0,0,0],
  0x58: [0,0,0xC6,0xC6,0x6C,0x38,0x38,0x6C,0xC6,0xC6,0,0,0,0,0,0],
  0x59: [0,0,0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x3C,0,0,0,0,0,0],
  0x5A: [0,0,0xFE,0xC6,0x0C,0x18,0x30,0x60,0xC6,0xFE,0,0,0,0,0,0],
  // [ ] \ ^ _ `
  0x5B: [0,0,0x3C,0x30,0x30,0x30,0x30,0x30,0x30,0x3C,0,0,0,0,0,0],
  0x5C: [0,0,0xC0,0x60,0x30,0x18,0x0C,0x06,0x02,0,0,0,0,0,0,0],
  0x5D: [0,0,0x3C,0x0C,0x0C,0x0C,0x0C,0x0C,0x0C,0x3C,0,0,0,0,0,0],
  0x5E: [0x10,0x38,0x6C,0xC6,0,0,0,0,0,0,0,0,0,0,0,0],
  0x5F: [0,0,0,0,0,0,0,0,0,0,0,0xFF,0,0,0,0],
  0x60: [0x30,0x18,0x0C,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // a-z
  0x61: [0,0,0,0,0x78,0x0C,0x7C,0xCC,0xCC,0x76,0,0,0,0,0,0],
  0x62: [0,0,0xE0,0x60,0x7C,0x66,0x66,0x66,0x66,0xDC,0,0,0,0,0,0],
  0x63: [0,0,0,0,0x7C,0xC6,0xC0,0xC0,0xC6,0x7C,0,0,0,0,0,0],
  0x64: [0,0,0x1C,0x0C,0x7C,0xCC,0xCC,0xCC,0xCC,0x76,0,0,0,0,0,0],
  0x65: [0,0,0,0,0x7C,0xC6,0xFE,0xC0,0xC6,0x7C,0,0,0,0,0,0],
  0x66: [0,0,0x1C,0x36,0x30,0x78,0x30,0x30,0x30,0x78,0,0,0,0,0,0],
  0x67: [0,0,0,0,0x76,0xCC,0xCC,0x7C,0x0C,0xCC,0x78,0,0,0,0,0],
  0x68: [0,0,0xE0,0x60,0x6C,0x76,0x66,0x66,0x66,0xE6,0,0,0,0,0,0],
  0x69: [0,0,0x18,0,0x38,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0],
  0x6A: [0,0,0x06,0,0x0E,0x06,0x06,0x06,0x66,0x66,0x3C,0,0,0,0,0],
  0x6B: [0,0,0xE0,0x60,0x66,0x6C,0x78,0x6C,0x66,0xE6,0,0,0,0,0,0],
  0x6C: [0,0,0x38,0x18,0x18,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0],
  0x6D: [0,0,0,0,0xEC,0xFE,0xD6,0xD6,0xC6,0xC6,0,0,0,0,0,0],
  0x6E: [0,0,0,0,0xDC,0x66,0x66,0x66,0x66,0x66,0,0,0,0,0,0],
  0x6F: [0,0,0,0,0x7C,0xC6,0xC6,0xC6,0xC6,0x7C,0,0,0,0,0,0],
  0x70: [0,0,0,0,0xDC,0x66,0x66,0x7C,0x60,0x60,0xF0,0,0,0,0,0],
  0x71: [0,0,0,0,0x76,0xCC,0xCC,0x7C,0x0C,0x0C,0x1E,0,0,0,0,0],
  0x72: [0,0,0,0,0xDC,0x76,0x60,0x60,0x60,0xF0,0,0,0,0,0,0],
  0x73: [0,0,0,0,0x7C,0xC0,0x7C,0x06,0x06,0x7C,0,0,0,0,0,0],
  0x74: [0,0,0x10,0x30,0xFC,0x30,0x30,0x30,0x36,0x1C,0,0,0,0,0,0],
  0x75: [0,0,0,0,0xCC,0xCC,0xCC,0xCC,0xCC,0x76,0,0,0,0,0,0],
  0x76: [0,0,0,0,0xC6,0xC6,0xC6,0x6C,0x38,0x10,0,0,0,0,0,0],
  0x77: [0,0,0,0,0xC6,0xC6,0xD6,0xFE,0xEE,0xC6,0,0,0,0,0,0],
  0x78: [0,0,0,0,0xC6,0x6C,0x38,0x38,0x6C,0xC6,0,0,0,0,0,0],
  0x79: [0,0,0,0,0xC6,0xC6,0xC6,0x7E,0x06,0x0C,0xF8,0,0,0,0,0],
  0x7A: [0,0,0,0,0xFE,0x0C,0x18,0x30,0x60,0xFE,0,0,0,0,0,0],
  // { | } ~
  0x7B: [0,0,0x0E,0x18,0x18,0x70,0x18,0x18,0x0E,0,0,0,0,0,0,0],
  0x7C: [0,0,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0,0,0,0,0,0],
  0x7D: [0,0,0x70,0x18,0x18,0x0E,0x18,0x18,0x70,0,0,0,0,0,0,0],
  0x7E: [0,0,0x76,0xDC,0,0,0,0,0,0,0,0,0,0,0,0],
  // Shade characters
  0x2591: Array(16).fill(0x55), // ░ light shade
  0x2592: Array(16).fill(0xAA), // ▒ medium shade
  0x2593: Array(16).fill(0xDB), // ▓ dark shade
  0x2588: Array(16).fill(0xFF), // █ full block
  // Box-drawing basics
  0x2500: [0,0,0,0,0,0,0,0xFF,0,0,0,0,0,0,0,0], // ─
  0x2502: [0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18], // │
  0x250C: [0,0,0,0,0,0,0,0x1F,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18], // ┌
  0x2510: [0,0,0,0,0,0,0,0xF8,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18], // ┐
  0x2514: [0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x1F,0,0,0,0,0,0,0,0], // └
  0x2518: [0x18,0x18,0x18,0x18,0x18,0x18,0x18,0xF8,0,0,0,0,0,0,0,0], // ┘
}

/** Upscale 8×16 bitmask font to 16×32 alpha array with edge smoothing */
function initFont(): void {
  const BASE_W = 8
  const BASE_H = 16

  for (const [cp, rows] of Object.entries(FONT_DATA)) {
    const codepoint = Number(cp)

    // First, build the base 8×16 binary grid
    const base = new Uint8Array(BASE_W * BASE_H)
    for (let y = 0; y < BASE_H && y < rows.length; y++) {
      const row = rows[y]!
      for (let x = 0; x < BASE_W; x++) {
        if (row & (0x80 >> x)) {
          base[y * BASE_W + x] = 1
        }
      }
    }

    // Upscale 2x to 16×32 with edge smoothing
    const glyph = new Uint8Array(GLYPH_W * GLYPH_H)
    for (let by = 0; by < BASE_H; by++) {
      for (let bx = 0; bx < BASE_W; bx++) {
        const on = base[by * BASE_W + bx]!
        const dx = bx * 2
        const dy = by * 2

        if (on) {
          // Fully opaque for all 4 upscaled pixels
          glyph[dy * GLYPH_W + dx] = 255
          glyph[dy * GLYPH_W + dx + 1] = 255
          glyph[(dy + 1) * GLYPH_W + dx] = 255
          glyph[(dy + 1) * GLYPH_W + dx + 1] = 255
        }
      }
    }

    // Edge smoothing pass: add partial alpha (anti-aliasing) at edges
    // For each transparent pixel adjacent to an opaque pixel, set partial alpha
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (glyph[y * GLYPH_W + x]! > 0) continue // already opaque

        // Count opaque neighbors (4-connected + diagonals)
        let neighbors = 0
        let diagonals = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < GLYPH_W && ny >= 0 && ny < GLYPH_H) {
              if (glyph[ny * GLYPH_W + nx]! > 0) {
                if (dx === 0 || dy === 0) neighbors++
                else diagonals++
              }
            }
          }
        }

        // Apply partial alpha based on neighbor count for smooth edges
        if (neighbors >= 2) {
          glyph[y * GLYPH_W + x] = 96
        } else if (neighbors === 1 && diagonals >= 1) {
          glyph[y * GLYPH_W + x] = 48
        }
      }
    }

    FONT.set(codepoint, glyph)
  }
}

initFont()

// ============================================================================
// Shade character detection
// ============================================================================

const SHADE_ALPHA: Record<number, number> = {
  0x2591: 64,  // ░ 25%
  0x2592: 128, // ▒ 50%
  0x2593: 192, // ▓ 75%
  0x2588: 255, // █ 100%
}

// ============================================================================
// PNG rendering
// ============================================================================

export interface AnsiToPngOptions {
  /** Pixel scale factor. Default: 2 */
  scale?: number
  /** Horizontal padding in pixels (before scaling). Default: 20 */
  paddingX?: number
  /** Vertical padding in pixels (before scaling). Default: 16 */
  paddingY?: number
  /** Background color. Default: [30, 30, 30] */
  backgroundColor?: RGB
  /** Default text color. Default: [229, 229, 229] */
  defaultColor?: RGB
  /** Border radius in pixels (before scaling). Default: 10 */
  borderRadius?: number
}

/**
 * Render ANSI-escaped text to a PNG buffer.
 *
 * Pipeline:
 * 1. Parse ANSI escape sequences
 * 2. Calculate pixel dimensions
 * 3. Initialize RGBA buffer with background
 * 4. Blit each glyph with alpha compositing
 * 5. Apply rounded corners
 * 6. Encode as PNG
 */
export function ansiToPng(ansiText: string, options?: AnsiToPngOptions): Buffer {
  const scale = options?.scale ?? 2
  const paddingX = options?.paddingX ?? 20
  const paddingY = options?.paddingY ?? 16
  const bg = options?.backgroundColor ?? [30, 30, 30]
  const defaultColor = options?.defaultColor ?? [229, 229, 229]
  const borderRadius = options?.borderRadius ?? 10

  const lines = parseAnsi(ansiText)

  // Calculate dimensions
  let maxCols = 0
  for (const spans of lines) {
    let cols = 0
    for (const s of spans) cols += s.text.length
    if (cols > maxCols) maxCols = cols
  }
  const rows = lines.length

  const width = (maxCols * GLYPH_W + paddingX * 2) * scale
  const height = (rows * GLYPH_H + paddingY * 2) * scale

  if (width <= 0 || height <= 0) {
    return encodePng(1, 1, new Uint8Array(4))
  }

  // Initialize RGBA pixel buffer with background color
  const px = new Uint8Array(width * height * 4)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = bg[0]
    px[i + 1] = bg[1]
    px[i + 2] = bg[2]
    px[i + 3] = 255
  }

  // Blit glyphs
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const spans = lines[lineIdx]!
    let col = 0

    for (const span of spans) {
      const color = span.color ?? defaultColor
      for (let ci = 0; ci < span.text.length; ci++) {
        const cp = span.text.codePointAt(ci) ?? 0x20
        const x = (col * GLYPH_W + paddingX) * scale
        const y = (lineIdx * GLYPH_H + paddingY) * scale

        const shadeAlpha = SHADE_ALPHA[cp]
        if (shadeAlpha !== undefined) {
          blitShade(px, width, x, y, color, shadeAlpha, bg, scale)
        } else {
          const glyph = FONT.get(cp) ?? FALLBACK_GLYPH
          blitGlyph(px, width, x, y, glyph, color, span.bold, scale)
        }

        col++
        // Skip surrogate pair low half
        if (cp > 0xFFFF) ci++
      }
    }
  }

  // Apply rounded corners (make corner pixels transparent)
  if (borderRadius > 0) {
    applyRoundedCorners(px, width, height, borderRadius * scale)
  }

  return encodePng(width, height, px)
}

// ============================================================================
// Glyph blitting
// ============================================================================

/** Alpha-composite a single glyph onto the pixel buffer */
function blitGlyph(
  px: Uint8Array,
  imgWidth: number,
  x: number,
  y: number,
  glyph: Uint8Array,
  color: RGB,
  bold: boolean,
  scale: number,
): void {
  for (let gy = 0; gy < GLYPH_H; gy++) {
    for (let gx = 0; gx < GLYPH_W; gx++) {
      let alpha = glyph[gy * GLYPH_W + gx]!
      if (alpha === 0) continue
      if (bold) alpha = Math.min(255, Math.round(alpha * 1.4))

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px_x = x + gx * scale + sx
          const px_y = y + gy * scale + sy
          if (px_x >= imgWidth) continue
          const idx = (px_y * imgWidth + px_x) * 4
          // Alpha composite: dst = (src * alpha + dst * (255 - alpha)) >> 8
          px[idx] = (color[0] * alpha + px[idx]! * (255 - alpha)) >> 8
          px[idx + 1] = (color[1] * alpha + px[idx + 1]! * (255 - alpha)) >> 8
          px[idx + 2] = (color[2] * alpha + px[idx + 2]! * (255 - alpha)) >> 8
        }
      }
    }
  }
}

/** Fill a cell with a shade character (uniform alpha blend) */
function blitShade(
  px: Uint8Array,
  imgWidth: number,
  x: number,
  y: number,
  color: RGB,
  alpha: number,
  bg: RGB,
  scale: number,
): void {
  const r = (color[0] * alpha + bg[0] * (255 - alpha)) >> 8
  const g = (color[1] * alpha + bg[1] * (255 - alpha)) >> 8
  const b = (color[2] * alpha + bg[2] * (255 - alpha)) >> 8

  for (let gy = 0; gy < GLYPH_H * scale; gy++) {
    for (let gx = 0; gx < GLYPH_W * scale; gx++) {
      const idx = ((y + gy) * imgWidth + (x + gx)) * 4
      px[idx] = r
      px[idx + 1] = g
      px[idx + 2] = b
    }
  }
}

/** Make corner pixels transparent for rounded rectangle effect */
function applyRoundedCorners(
  px: Uint8Array,
  width: number,
  height: number,
  radius: number,
): void {
  const r2 = radius * radius
  const corners = [
    [0, 0],                      // top-left
    [width - radius, 0],         // top-right
    [0, height - radius],        // bottom-left
    [width - radius, height - radius], // bottom-right
  ]

  for (const [cx, cy] of corners) {
    for (let oy = 0; oy < radius; oy++) {
      for (let ox = 0; ox < radius; ox++) {
        // Distance from the inner corner point
        const dx = radius - ox - 0.5
        const dy = radius - oy - 0.5
        if (dx * dx + dy * dy > r2) {
          const px_x = cx! + ox
          const px_y = cy! + oy
          if (px_x >= 0 && px_x < width && px_y >= 0 && px_y < height) {
            const idx = (px_y * width + px_x) * 4
            px[idx + 3] = 0 // Set alpha to transparent
          }
        }
      }
    }
  }
}

// ============================================================================
// PNG encoder (pure TypeScript using Node.js zlib)
// ============================================================================

/** CRC32 lookup table */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xFF]! ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** Build a PNG chunk: [length:u32be][type:4chars][data][crc32:u32be] */
function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)

  const typeBytes = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput))

  return Buffer.concat([len, typeBytes, data, crc])
}

/** Encode an RGBA pixel buffer as a PNG file */
function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

  // IHDR: width, height, bit_depth=8, color_type=6(RGBA), compression=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0  // deflate
  ihdr[11] = 0  // filter none
  ihdr[12] = 0  // no interlace

  // IDAT: filter byte (0=None) + row data for each scanline
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1)
    raw[offset] = 0 // filter: None
    pixels.slice(y * stride, (y + 1) * stride).forEach((v, i) => {
      raw[offset + 1 + i] = v
    })
  }
  const compressed = deflateSync(raw)

  // IEND: empty
  const iend = Buffer.alloc(0)

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', iend),
  ])
}
