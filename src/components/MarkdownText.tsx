/**
 * MarkdownText — Renders markdown-formatted text using Ink primitives.
 *
 * Parses basic markdown syntax and renders with appropriate Ink styles:
 * - **bold** → <Text bold>
 * - *italic* → <Text italic>  
 * - `code` → <Text inverse> (highlighted inline code)
 * - ```code blocks``` → boxed code with language label
 * - - bullet lists → indented with bullet char
 * - [links](url) → shown as "text (url)"
 * - # headings → bold + underline
 */

import React from 'react'
import { Box, Text } from 'ink'
import { CodeBlock } from './HighlightedCode/HighlightedCode.js'

// ============================================================================
// Basic syntax highlighting for code lines
// ============================================================================

// Keywords by language family
const JS_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete|true|false|null|undefined)\b/g
const PY_KEYWORDS = /\b(def|class|return|if|elif|else|for|while|with|as|import|from|try|except|finally|raise|pass|break|continue|yield|lambda|and|or|not|in|is|True|False|None|self|async|await|print)\b/g
const RUST_KEYWORDS = /\b(fn|let|mut|const|if|else|for|while|loop|match|return|use|mod|pub|struct|enum|impl|trait|type|where|async|await|self|Self|true|false|move|ref|unsafe)\b/g
const STRING_PATTERN = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g
const COMMENT_PATTERN = /(\/\/.*$|#.*$)/gm
const NUMBER_PATTERN = /\b(\d+\.?\d*)\b/g

const CodeLine: React.FC<{ line: string; lang: string }> = ({ line, lang }) => {
  if (!lang || !line.trim()) return <>{line}</>

  const keywords = ['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(lang) ? JS_KEYWORDS
    : ['py', 'python'].includes(lang) ? PY_KEYWORDS
    : ['rs', 'rust'].includes(lang) ? RUST_KEYWORDS
    : null

  if (!keywords) return <>{line}</>

  // Simple approach: split line into tokens and colorize
  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  // Check for comments first (they take precedence)
  const commentMatch = remaining.match(/^(\s*)(\/\/.*|#.*)$/)
  if (commentMatch) {
    return <><Text>{commentMatch[1]}</Text><Text color="gray" italic>{commentMatch[2]}</Text></>
  }

  // Process string literals
  const stringRegex = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = stringRegex.exec(remaining)) !== null) {
    // Text before string
    if (match.index > lastIdx) {
      const before = remaining.slice(lastIdx, match.index)
      parts.push(<HighlightKeywords key={key++} text={before} keywords={keywords} />)
    }
    // The string literal
    parts.push(<Text key={key++} color="green">{match[0]}</Text>)
    lastIdx = match.index + match[0].length
  }

  // Remaining text after last string
  if (lastIdx < remaining.length) {
    parts.push(<HighlightKeywords key={key++} text={remaining.slice(lastIdx)} keywords={keywords} />)
  }

  if (parts.length === 0) {
    return <HighlightKeywords text={line} keywords={keywords} />
  }

  return <>{parts}</>
}

const HighlightKeywords: React.FC<{ text: string; keywords: RegExp }> = ({ text, keywords }) => {
  // Reset regex lastIndex
  keywords.lastIndex = 0
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = keywords.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<Text key={key++}>{text.slice(lastIdx, match.index)}</Text>)
    }
    parts.push(<Text key={key++} color="magenta" bold>{match[0]}</Text>)
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(<Text key={key++}>{text.slice(lastIdx)}</Text>)
  }

  if (parts.length === 0) return <Text>{text}</Text>
  return <>{parts}</>
}

export interface MarkdownTextProps {
  children: string
}

/**
 * Render a string with basic markdown formatting.
 * Handles inline formatting and block-level elements.
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ children }) => {
  const lines = children.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trimStart().startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing ```
      const code = codeLines.join('\n')
      blocks.push(
        <Box key={`code-${blocks.length}`} marginTop={1}>
          <CodeBlock code={code} language={lang || undefined} maxLines={100} />
        </Box>
      )
      continue
    }

    // Heading
    if (line.startsWith('# ')) {
      blocks.push(<Text key={`h-${blocks.length}`} bold underline>{'\n' + line.slice(2)}</Text>)
      i++
      continue
    }
    if (line.startsWith('## ')) {
      blocks.push(<Text key={`h2-${blocks.length}`} bold>{'\n' + line.slice(3)}</Text>)
      i++
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push(<Text key={`h3-${blocks.length}`} bold>{line.slice(4)}</Text>)
      i++
      continue
    }

    // Bullet list
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
      const content = line.replace(/^\s*[-*]\s+/, '')
      blocks.push(
        <Box key={`li-${blocks.length}`} marginLeft={indent}>
          <Text color="cyan">{'\u2022 '}</Text>
          <InlineMarkdown text={content} />
        </Box>
      )
      i++
      continue
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s+(.*)/)
      if (match) {
        const indent = match[1]?.length ?? 0
        blocks.push(
          <Box key={`ol-${blocks.length}`} marginLeft={indent}>
            <Text dimColor>{match[2]}. </Text>
            <InlineMarkdown text={match[3]!} />
          </Box>
        )
      }
      i++
      continue
    }

    // Markdown table — lines starting with |
    if (line.trimStart().startsWith('|') && line.trimEnd().endsWith('|')) {
      const tableRows: string[][] = []
      let hasHeader = false

      while (i < lines.length) {
        const tl = lines[i]!.trim()
        if (!tl.startsWith('|') || !tl.endsWith('|')) break
        if (/^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(tl)) {
          hasHeader = true
          i++
          continue
        }
        const cells = tl.split('|').slice(1, -1).map(c => c.trim())
        tableRows.push(cells)
        i++
      }

      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map(r => r.length))

        // Calculate ideal widths from content
        const idealWidths: number[] = Array.from({ length: colCount }, (_, ci) =>
          Math.max(...tableRows.map(r => (r[ci] ?? '').length), 3)
        )

        // Available width: terminal (approx 78) minus borders overhead
        // Each column needs: 1 border + 1 space + content + 1 space = content + 3
        // Plus 1 for the leading border
        const maxTableWidth = 76 // safe default
        const borderOverhead = 1 + colCount * 3
        const availableForContent = maxTableWidth - borderOverhead

        // If total ideal fits, use ideal. Otherwise shrink proportionally.
        const totalIdeal = idealWidths.reduce((s, w) => s + w, 0)
        let colWidths: number[]

        if (totalIdeal <= availableForContent) {
          colWidths = idealWidths
        } else {
          // Shrink proportionally, with minimum of 5 chars per column
          const scale = availableForContent / totalIdeal
          colWidths = idealWidths.map(w => Math.max(Math.floor(w * scale), 5))

          // If still too wide after proportional shrink, truncate further
          const totalAfterScale = colWidths.reduce((s, w) => s + w, 0)
          if (totalAfterScale > availableForContent) {
            const excess = totalAfterScale - availableForContent
            // Shave from the widest column
            const widestIdx = colWidths.indexOf(Math.max(...colWidths))
            colWidths[widestIdx] = Math.max(colWidths[widestIdx]! - excess, 5)
          }
        }

        const headerRow = hasHeader ? tableRows[0] : null
        const dataRows = hasHeader ? tableRows.slice(1) : tableRows

        // Truncate a cell to fit its column width
        function fitCell(text: string, width: number): string {
          if (text.length <= width) return text.padEnd(width)
          return text.slice(0, width - 1) + '\u2026' // ellipsis
        }

        // Build box-drawing border line
        function borderLine(type: 'top' | 'mid' | 'bot'): string {
          const [l, m, x, r] = type === 'top' ? ['\u250C', '\u2500', '\u252C', '\u2510']
            : type === 'mid' ? ['\u251C', '\u2500', '\u253C', '\u2524']
            : ['\u2514', '\u2500', '\u2534', '\u2518']
          return l + colWidths.map(w => m.repeat(w + 2)).join(x) + r
        }

        // Build data row
        function dataLine(cells: string[]): string {
          return '\u2502' + Array.from({ length: colCount }, (_, ci) => {
            return ' ' + fitCell(cells[ci] ?? '', colWidths[ci]!) + ' '
          }).join('\u2502') + '\u2502'
        }

        const tableLines: string[] = []
        tableLines.push(borderLine('top'))
        if (headerRow) {
          tableLines.push(dataLine(headerRow))
          tableLines.push(borderLine('mid'))
        }
        dataRows.forEach((row, ri) => {
          tableLines.push(dataLine(row))
          if (ri < dataRows.length - 1) {
            tableLines.push(borderLine('mid'))
          }
        })
        tableLines.push(borderLine('bot'))

        const headerLineIdx = headerRow ? 1 : -1
        blocks.push(
          <Box key={`tbl-${blocks.length}`} flexDirection="column" marginTop={1}>
            {tableLines.map((tl, ti) => {
              const isBorder = tl.startsWith('\u250C') || tl.startsWith('\u251C') || tl.startsWith('\u2514')
              const isHeaderContent = ti === headerLineIdx
              return (
                <Text key={ti} dimColor={isBorder} bold={isHeaderContent}>{tl}</Text>
              )
            })}
          </Box>
        )
      }
      continue
    }

    // Empty line
    if (line.trim() === '') {
      blocks.push(<Text key={`br-${blocks.length}`}>{' '}</Text>)
      i++
      continue
    }

    // Regular paragraph with inline formatting
    blocks.push(
      <Box key={`p-${blocks.length}`}>
        <InlineMarkdown text={line} />
      </Box>
    )
    i++
  }

  return <Box flexDirection="column">{blocks}</Box>
}

/**
 * Render inline markdown: **bold**, *italic*, `code`, [links](url)
 */
const InlineMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      parts.push(<Text key={key++} bold>{boldMatch[1]}</Text>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      parts.push(<Text key={key++} italic>{italicMatch[1]}</Text>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(<Text key={key++} color="cyan">{codeMatch[1]}</Text>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      parts.push(<Text key={key++}><Text bold>{linkMatch[1]}</Text><Text dimColor> ({linkMatch[2]})</Text></Text>)
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Regular text: consume until next special char
    const nextSpecial = remaining.search(/[*`\[]/)
    if (nextSpecial === -1) {
      parts.push(<Text key={key++}>{remaining}</Text>)
      break
    }
    if (nextSpecial === 0) {
      // The special char didn't match any pattern, consume it
      parts.push(<Text key={key++}>{remaining[0]}</Text>)
      remaining = remaining.slice(1)
    } else {
      parts.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>)
      remaining = remaining.slice(nextSpecial)
    }
  }

  return <Text>{parts}</Text>
}

export default MarkdownText
