/**
 * ANSI terminal text → SVG conversion.
 *
 * Based on Claude Code's utils/ansiToSvg.ts.
 * Parses ANSI escape sequences (colors, bold, 256-color, 24-bit true color)
 * and generates an SVG with <tspan> elements for each colored segment.
 *
 * Zero external dependencies — pure TypeScript.
 */

import { escapeXml } from './xml.js'

// ============================================================================
// Types
// ============================================================================

export type RGB = [number, number, number]

export interface TextSpan {
  text: string
  color: RGB | null  // null = default foreground
  bold: boolean
}

export type ParsedLine = TextSpan[]

export interface AnsiToSvgOptions {
  /** Font size in pixels. Default: 14 */
  fontSize?: number
  /** Line height in pixels. Default: fontSize * 1.4 */
  lineHeight?: number
  /** Font family. Default: 'Menlo, Monaco, "Courier New", monospace' */
  fontFamily?: string
  /** Horizontal padding in pixels. Default: 16 */
  paddingX?: number
  /** Vertical padding in pixels. Default: 12 */
  paddingY?: number
  /** Background color. Default: [30, 30, 30] (dark gray) */
  backgroundColor?: RGB
  /** Default text color. Default: [229, 229, 229] (light gray) */
  defaultColor?: RGB
  /** Border radius in pixels. Default: 8 */
  borderRadius?: number
}

// ============================================================================
// ANSI color palette
// ============================================================================

/** Standard 8 ANSI colors (codes 30-37) */
const ANSI_COLORS: Record<number, RGB> = {
  30: [0, 0, 0],       // black
  31: [205, 49, 49],    // red
  32: [13, 188, 121],   // green
  33: [229, 229, 16],   // yellow
  34: [36, 114, 200],   // blue
  35: [188, 63, 188],   // magenta
  36: [17, 168, 205],   // cyan
  37: [229, 229, 229],  // white
}

/** Bright ANSI colors (codes 90-97) */
const BRIGHT_ANSI_COLORS: Record<number, RGB> = {
  90: [102, 102, 102],  // bright black (gray)
  91: [241, 76, 76],    // bright red
  92: [35, 209, 139],   // bright green
  93: [245, 245, 67],   // bright yellow
  94: [59, 142, 234],   // bright blue
  95: [214, 112, 214],  // bright magenta
  96: [41, 184, 219],   // bright cyan
  97: [255, 255, 255],  // bright white
}

/**
 * Get a color from the 256-color palette.
 *
 * 0-7:     standard colors
 * 8-15:    bright colors
 * 16-231:  216-color cube (6×6×6 RGB)
 * 232-255: grayscale ramp (24 shades)
 */
function get256Color(n: number): RGB {
  if (n < 0 || n > 255) return [229, 229, 229]

  // Standard colors 0-7
  if (n < 8) return ANSI_COLORS[30 + n] ?? [229, 229, 229]

  // Bright colors 8-15
  if (n < 16) return BRIGHT_ANSI_COLORS[90 + (n - 8)] ?? [229, 229, 229]

  // 216-color cube: 16-231
  if (n < 232) {
    const idx = n - 16
    const r = Math.floor(idx / 36)
    const g = Math.floor((idx % 36) / 6)
    const b = idx % 6
    const toVal = (v: number) => (v === 0 ? 0 : 55 + v * 40)
    return [toVal(r), toVal(g), toVal(b)]
  }

  // Grayscale ramp: 232-255
  const gray = 8 + (n - 232) * 10
  return [gray, gray, gray]
}

// ============================================================================
// ANSI parser
// ============================================================================

/**
 * Parse ANSI-escaped text into structured spans.
 *
 * Handles:
 * - Standard colors (30-37, 40-47)
 * - Bright colors (90-97, 100-107)
 * - 256-color mode (38;5;n)
 * - 24-bit true color (38;2;r;g;b)
 * - Bold (1) and reset (0)
 * - Default foreground reset (39)
 */
export function parseAnsi(text: string): ParsedLine[] {
  const lines = text.split('\n')
  const result: ParsedLine[] = []

  let currentColor: RGB | null = null
  let bold = false

  for (const line of lines) {
    const spans: TextSpan[] = []
    let remaining = line
    let textBuf = ''

    while (remaining.length > 0) {
      // Find next escape sequence
      const escIdx = remaining.indexOf('\x1b[')
      if (escIdx === -1) {
        textBuf += remaining
        remaining = ''
        break
      }

      // Collect text before the escape
      if (escIdx > 0) {
        textBuf += remaining.slice(0, escIdx)
      }
      remaining = remaining.slice(escIdx)

      // Find the end of the escape sequence (terminated by 'm')
      const endIdx = remaining.indexOf('m', 2)
      if (endIdx === -1) {
        // Malformed — treat as text
        textBuf += remaining[0]
        remaining = remaining.slice(1)
        continue
      }

      // Flush accumulated text
      if (textBuf) {
        spans.push({ text: textBuf, color: currentColor, bold })
        textBuf = ''
      }

      // Parse the SGR codes: \x1b[code1;code2;...m
      const codes = remaining.slice(2, endIdx).split(';').map(Number)
      remaining = remaining.slice(endIdx + 1)

      let i = 0
      while (i < codes.length) {
        const code = codes[i]!

        if (code === 0) {
          // Reset
          currentColor = null
          bold = false
        } else if (code === 1) {
          bold = true
        } else if (code >= 30 && code <= 37) {
          currentColor = ANSI_COLORS[code] ?? null
        } else if (code >= 90 && code <= 97) {
          currentColor = BRIGHT_ANSI_COLORS[code] ?? null
        } else if (code === 38) {
          // Extended foreground color
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            // 256-color: 38;5;n
            currentColor = get256Color(codes[i + 2]!)
            i += 2
          } else if (codes[i + 1] === 2 && codes[i + 4] !== undefined) {
            // 24-bit true color: 38;2;r;g;b
            currentColor = [codes[i + 2]!, codes[i + 3]!, codes[i + 4]!]
            i += 4
          }
        } else if (code === 39) {
          // Reset foreground to default
          currentColor = null
        }
        // Ignore background colors (40-47, 100-107, 48;5;n, 48;2;r;g;b)

        i++
      }
    }

    // Flush remaining text
    if (textBuf) {
      spans.push({ text: textBuf, color: currentColor, bold })
    }

    result.push(spans)
  }

  return result
}

// ============================================================================
// SVG generator
// ============================================================================

/**
 * Convert ANSI-escaped terminal text to an SVG string.
 *
 * The SVG uses monospace font, with <tspan> elements for colored/bold segments.
 * Background is a filled rectangle with optional rounded corners.
 */
export function ansiToSvg(ansiText: string, options?: AnsiToSvgOptions): string {
  const fontSize = options?.fontSize ?? 14
  const lineHeight = options?.lineHeight ?? Math.round(fontSize * 1.4)
  const fontFamily = options?.fontFamily ?? 'Menlo, Monaco, "Courier New", monospace'
  const paddingX = options?.paddingX ?? 16
  const paddingY = options?.paddingY ?? 12
  const bg = options?.backgroundColor ?? [30, 30, 30]
  const defaultColor = options?.defaultColor ?? [229, 229, 229]
  const borderRadius = options?.borderRadius ?? 8

  const lines = parseAnsi(ansiText)

  // Calculate dimensions
  const charWidth = fontSize * 0.6
  const maxLineLength = lines.reduce((max, spans) => {
    const len = spans.reduce((sum, s) => sum + s.text.length, 0)
    return Math.max(max, len)
  }, 0)
  const width = Math.ceil(maxLineLength * charWidth + paddingX * 2)
  const height = Math.ceil(lines.length * lineHeight + paddingY * 2)

  // Build SVG
  const svgParts: string[] = []

  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<style>`,
    `  text { font-family: ${fontFamily}; font-size: ${fontSize}px; }`,
    `  .b { font-weight: bold; }`,
    `</style>`,
    `<rect width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="rgb(${bg[0]},${bg[1]},${bg[2]})" />`,
  )

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const spans = lines[lineIdx]!
    if (spans.length === 0) continue

    const y = paddingY + (lineIdx + 1) * lineHeight - Math.round(lineHeight * 0.2)
    const x = paddingX

    svgParts.push(`<text x="${x}" y="${y}" xml:space="preserve">`)

    for (const span of spans) {
      if (!span.text) continue

      const color = span.color ?? defaultColor
      const fill = `rgb(${color[0]},${color[1]},${color[2]})`
      const cls = span.bold ? ' class="b"' : ''

      svgParts.push(`<tspan fill="${fill}"${cls}>${escapeXml(span.text)}</tspan>`)
    }

    svgParts.push(`</text>`)
  }

  svgParts.push(`</svg>`)

  return svgParts.join('\n')
}
