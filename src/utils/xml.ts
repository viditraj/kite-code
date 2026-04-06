/**
 * XML/HTML escaping utilities for safe SVG generation.
 *
 * Ported from Claude Code's utils/xml.ts.
 */

/** Escape text content for XML elements (& < >) */
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape attribute values for XML (& < > " ') */
export function escapeXmlAttr(s: string): string {
  return escapeXml(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
