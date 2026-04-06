/**
 * DiagramTool — Generate SVG/PNG diagrams from text descriptions.
 *
 * Provides two rendering modes:
 * 1. ANSI mode: Render ANSI-escaped terminal art to SVG/PNG (pure TS, zero deps)
 * 2. Mermaid mode: Render Mermaid diagram syntax to SVG (requires mmdc)
 *
 * The LLM can create diagrams by writing either ANSI-colored text art or
 * Mermaid syntax, and this tool converts it to an image file.
 */

import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve, extname } from 'path'
import { execSync } from 'child_process'

const DIAGRAM_TOOL_NAME = 'Diagram'

const inputSchema = z.object({
  content: z.string().describe('The diagram content: either ANSI-escaped text or Mermaid syntax'),
  output_path: z.string().describe('Output file path (must end in .svg or .png)'),
  format: z.enum(['ansi', 'mermaid']).optional().describe(
    'Rendering mode: "ansi" for ANSI terminal art, "mermaid" for Mermaid diagram syntax. Default: auto-detect',
  ),
}).passthrough()

type DiagramInput = z.infer<typeof inputSchema>

interface DiagramOutput {
  path: string
  format: string
  bytes: number
  width?: number
  height?: number
}

export const DiagramTool = buildTool({
  name: DIAGRAM_TOOL_NAME,
  searchHint: 'create diagrams, charts, flowcharts, and visual images from text',
  maxResultSizeChars: 10_000,
  shouldDefer: false,
  strict: false,

  inputSchema,

  isReadOnly: () => false,
  isConcurrencySafe: () => true,

  async description(input: DiagramInput) {
    return `Create diagram: ${input.output_path}`
  },

  async prompt() {
    return `Create diagrams and visual images from text content. Supports two rendering modes:

1. **ANSI mode** (format="ansi"): Write ANSI-escaped terminal art with colors and the tool renders it as a beautiful SVG or PNG image. Use ANSI escape codes for colors:
   - \\x1b[1m = bold
   - \\x1b[31m-\\x1b[37m = standard colors (red, green, yellow, blue, magenta, cyan, white)
   - \\x1b[91m-\\x1b[97m = bright colors
   - \\x1b[0m = reset
   - Unicode box-drawing characters: ─ │ ┌ ┐ └ ┘
   - Unicode shade blocks: ░ ▒ ▓ █ for progress bars and fills

2. **Mermaid mode** (format="mermaid"): Write Mermaid diagram syntax (flowcharts, sequence diagrams, class diagrams, etc.) and the tool renders it as SVG.

Output path must end in .svg or .png. Parent directories are created automatically.

Examples:
- Architecture diagrams with colored boxes and arrows
- Flowcharts with decision nodes
- Sequence diagrams for API flows
- Progress bars and stats visualizations
- Any text-based visual rendered as a clean image`
  },

  async validateInput(input: DiagramInput) {
    const ext = extname(input.output_path).toLowerCase()
    if (ext !== '.svg' && ext !== '.png') {
      return { result: false, message: 'Output path must end in .svg or .png' }
    }
    if (!input.content || input.content.trim().length === 0) {
      return { result: false, message: 'Content cannot be empty' }
    }
    return { result: true }
  },

  async call(input: DiagramInput, context: ToolUseContext) {
    const outputPath = resolve(input.output_path)
    const ext = extname(outputPath).toLowerCase()

    // Auto-detect format if not specified
    let format = input.format
    if (!format) {
      const trimmed = input.content.trimStart()
      // Mermaid starts with keywords like graph, sequenceDiagram, classDiagram, etc.
      if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitgraph|journey|mindmap|timeline)\b/i.test(trimmed)) {
        format = 'mermaid'
      } else {
        format = 'ansi'
      }
    }

    // Ensure output directory exists
    const dir = dirname(outputPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    if (format === 'mermaid') {
      return renderMermaid(input.content, outputPath, ext)
    } else {
      return renderAnsi(input.content, outputPath, ext)
    }
  },

  mapToolResultToToolResultBlockParam(data: DiagramOutput, toolUseID: string) {
    const sizeInfo = data.width && data.height ? ` (${data.width}x${data.height})` : ''
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: `Diagram saved to ${data.path} (${data.format}, ${data.bytes.toLocaleString()} bytes${sizeInfo})`,
    }
  },
})

// ============================================================================
// ANSI rendering
// ============================================================================

async function renderAnsi(
  content: string,
  outputPath: string,
  ext: string,
): Promise<{ data: DiagramOutput }> {
  if (ext === '.svg') {
    const { ansiToSvg } = await import('../../utils/ansiToSvg.js')
    const svg = ansiToSvg(content)
    writeFileSync(outputPath, svg, 'utf-8')
    return {
      data: {
        path: outputPath,
        format: 'ansi-svg',
        bytes: Buffer.byteLength(svg),
      },
    }
  } else {
    // PNG
    const { ansiToPng } = await import('../../utils/ansiToPng.js')
    const png = ansiToPng(content, { scale: 3, paddingX: 28, paddingY: 20, borderRadius: 14 })
    writeFileSync(outputPath, png)
    return {
      data: {
        path: outputPath,
        format: 'ansi-png',
        bytes: png.length,
      },
    }
  }
}

// ============================================================================
// Mermaid rendering
// ============================================================================

async function renderMermaid(
  content: string,
  outputPath: string,
  ext: string,
): Promise<{ data: DiagramOutput }> {
  // Write mermaid content to a temp file
  const tmpMmd = outputPath + '.tmp.mmd'

  try {
    writeFileSync(tmpMmd, content, 'utf-8')

    // Build mmdc command with --no-sandbox for root environments
    const puppeteerConfig = '{"args":["--no-sandbox","--disable-setuid-sandbox"]}'
    const tmpConfig = outputPath + '.tmp.puppeteer.json'
    writeFileSync(tmpConfig, puppeteerConfig, 'utf-8')

    try {
      execSync(
        `npx mmdc -i "${tmpMmd}" -o "${outputPath}" -p "${tmpConfig}"`,
        { timeout: 30_000, stdio: 'pipe' },
      )
    } finally {
      // Clean up config
      try { const fs = await import('fs'); fs.unlinkSync(tmpConfig) } catch {}
    }

    const { statSync } = await import('fs')
    const stat = statSync(outputPath)

    return {
      data: {
        path: outputPath,
        format: `mermaid-${ext.slice(1)}`,
        bytes: stat.size,
      },
    }
  } finally {
    // Clean up temp mermaid file
    try { const fs = await import('fs'); fs.unlinkSync(tmpMmd) } catch {}
  }
}

export { DIAGRAM_TOOL_NAME }
