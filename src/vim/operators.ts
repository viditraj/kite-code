/**
 * Vim operator execution.
 *
 * Implements the same operators as Claude Code's vim/operators.ts:
 * - delete, change, yank with motions and text objects
 * - x (delete char), ~ (toggle case), J (join lines)
 * - p/P (paste), o/O (open line)
 * - r (replace char)
 * - >>/<<  (indent)
 */

import type { Operator, FindType, TextObjScope, RecordedChange, PersistentState } from './types.js'
import { resolveMotion, type TextBuffer, type CursorPosition, type MotionResult } from './motions.js'
import { resolveTextObject, type TextRange } from './textObjects.js'

// ============================================================================
// Operator context — what the buffer provides
// ============================================================================

export interface OperatorContext {
  /** Get current buffer state */
  getBuffer(): TextBuffer
  /** Replace text in range */
  replaceRange(startLine: number, startCol: number, endLine: number, endCol: number, text: string): void
  /** Delete a range of lines */
  deleteLines(startLine: number, count: number): string[]
  /** Insert text at cursor */
  insertAt(line: number, col: number, text: string): void
  /** Set cursor position */
  setCursor(pos: CursorPosition): void
  /** Get persistent state */
  getPersistent(): PersistentState
  /** Update persistent state */
  setPersistent(update: Partial<PersistentState>): void
  /** Switch to insert mode */
  enterInsertMode(): void
  /** Copy text to system clipboard (optional) */
  copyToClipboard?(text: string): void
}

// ============================================================================
// Motion-based operators (d{motion}, c{motion}, y{motion})
// ============================================================================

export function executeOperatorMotion(
  op: Operator,
  motionKey: string,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  const buf = ctx.getBuffer()
  const motion = resolveMotion(motionKey, buf, count)
  if (!motion) return null

  const { cursor } = buf
  const { newCursor, linewise } = motion

  // Determine range (start <= end)
  const startLine = Math.min(cursor.line, newCursor.line)
  const endLine = Math.max(cursor.line, newCursor.line)
  const startCol = cursor.line <= newCursor.line ? cursor.col : newCursor.col
  const endCol = cursor.line <= newCursor.line ? newCursor.col : cursor.col

  if (linewise) {
    // Line-wise operation
    const deleted = ctx.deleteLines(startLine, endLine - startLine + 1)
    const text = deleted.join('\n')

    ctx.setPersistent({
      register: text,
      registerIsLinewise: true,
      lastChange: { type: 'operator', op, motion: motionKey, count },
    })

    ctx.setCursor({ line: Math.min(startLine, buf.lines.length - 1), col: 0 })

    if (op === 'change') {
      ctx.insertAt(startLine, 0, '')
      ctx.enterInsertMode()
    }
  } else {
    // Character-wise operation
    const line = buf.lines[cursor.line] ?? ''
    const from = Math.min(startCol, endCol)
    const to = Math.max(startCol, endCol) + 1
    const text = line.slice(from, to)

    ctx.replaceRange(cursor.line, from, cursor.line, to, op === 'yank' ? line.slice(from, to) : '')

    if (op !== 'yank') {
      // For delete/change: remove text
      const newLine = line.slice(0, from) + line.slice(to)
      ctx.replaceRange(cursor.line, 0, cursor.line, line.length, newLine)
    }

    ctx.setPersistent({
      register: text,
      registerIsLinewise: false,
      lastChange: { type: 'operator', op, motion: motionKey, count },
    })

    ctx.setCursor({ line: cursor.line, col: from })

    if (op === 'change') {
      ctx.enterInsertMode()
    }
  }

  return { type: 'operator', op, motion: motionKey, count }
}

// ============================================================================
// Text object operators (di{obj}, ci{obj}, yi{obj})
// ============================================================================

export function executeOperatorTextObj(
  op: Operator,
  objType: string,
  scope: TextObjScope,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  const buf = ctx.getBuffer()
  const line = buf.lines[buf.cursor.line] ?? ''
  const range = resolveTextObject(line, buf.cursor.col, objType, scope)
  if (!range) return null

  const text = line.slice(range.start, range.end)

  if (op !== 'yank') {
    const newLine = line.slice(0, range.start) + line.slice(range.end)
    ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
    ctx.setCursor({ line: buf.cursor.line, col: range.start })
  }

  ctx.setPersistent({
    register: text,
    registerIsLinewise: false,
    lastChange: { type: 'operatorTextObj', op, objType, scope, count },
  })

  if (op === 'change') {
    ctx.enterInsertMode()
  }

  return { type: 'operatorTextObj', op, objType, scope, count }
}

// ============================================================================
// Find-based operators (df{char}, ct{char}, etc.)
// ============================================================================

export function executeOperatorFind(
  op: Operator,
  findType: FindType,
  char: string,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  const buf = ctx.getBuffer()
  const line = buf.lines[buf.cursor.line] ?? ''
  const col = buf.cursor.col

  let targetCol = findChar(line, col, findType, char, count)
  if (targetCol === -1) return null

  // For t/T, adjust position (to/till)
  if (findType === 't' && targetCol > col) targetCol--
  if (findType === 'T' && targetCol < col) targetCol++

  const from = Math.min(col, targetCol)
  const to = Math.max(col, targetCol) + 1
  const text = line.slice(from, to)

  if (op !== 'yank') {
    const newLine = line.slice(0, from) + line.slice(to)
    ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
    ctx.setCursor({ line: buf.cursor.line, col: from })
  }

  ctx.setPersistent({
    register: text,
    registerIsLinewise: false,
    lastFind: { type: findType, char },
    lastChange: { type: 'operatorFind', op, find: findType, char, count },
  })

  if (op === 'change') {
    ctx.enterInsertMode()
  }

  return { type: 'operatorFind', op, find: findType, char, count }
}

// ============================================================================
// Line operators (dd, cc, yy)
// ============================================================================

export function executeLineOp(
  op: Operator,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  const buf = ctx.getBuffer()
  const startLine = buf.cursor.line
  const endLine = Math.min(startLine + count - 1, buf.lines.length - 1)

  const deleted = ctx.deleteLines(startLine, endLine - startLine + 1)
  const text = deleted.join('\n')

  ctx.setPersistent({
    register: text,
    registerIsLinewise: true,
    lastChange: { type: 'operator', op, motion: op === 'delete' ? 'd' : op === 'change' ? 'c' : 'y', count },
  })

  const newLine = Math.min(startLine, buf.lines.length - 1)
  ctx.setCursor({ line: Math.max(0, newLine), col: 0 })

  if (op === 'change') {
    ctx.insertAt(startLine, 0, '')
    ctx.enterInsertMode()
  }

  return { type: 'operator', op, motion: op[0]!, count }
}

// ============================================================================
// Simple operators
// ============================================================================

export function executeX(count: number, ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  const line = buf.lines[buf.cursor.line] ?? ''
  const col = buf.cursor.col
  const end = Math.min(col + count, line.length)
  const text = line.slice(col, end)
  const newLine = line.slice(0, col) + line.slice(end)

  ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
  ctx.setPersistent({ register: text, registerIsLinewise: false, lastChange: { type: 'x', count } })
  ctx.setCursor({ line: buf.cursor.line, col: Math.min(col, newLine.length - 1) })

  return { type: 'x', count }
}

export function executeToggleCase(count: number, ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  const line = buf.lines[buf.cursor.line] ?? ''
  const col = buf.cursor.col
  const end = Math.min(col + count, line.length)

  let toggled = ''
  for (let i = col; i < end; i++) {
    const ch = line[i]!
    toggled += ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
  }

  const newLine = line.slice(0, col) + toggled + line.slice(end)
  ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
  ctx.setPersistent({ lastChange: { type: 'toggleCase', count } })
  ctx.setCursor({ line: buf.cursor.line, col: Math.min(end, newLine.length - 1) })

  return { type: 'toggleCase', count }
}

export function executeReplace(char: string, count: number, ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  const line = buf.lines[buf.cursor.line] ?? ''
  const col = buf.cursor.col
  const end = Math.min(col + count, line.length)

  const replaced = char.repeat(end - col)
  const newLine = line.slice(0, col) + replaced + line.slice(end)
  ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
  ctx.setPersistent({ lastChange: { type: 'replace', char, count } })

  return { type: 'replace', char, count }
}

export function executePaste(before: boolean, ctx: OperatorContext): void {
  const persistent = ctx.getPersistent()
  if (!persistent.register) return

  const buf = ctx.getBuffer()

  if (persistent.registerIsLinewise) {
    const targetLine = before ? buf.cursor.line : buf.cursor.line + 1
    ctx.insertAt(targetLine, 0, persistent.register + '\n')
    ctx.setCursor({ line: targetLine, col: 0 })
  } else {
    const line = buf.lines[buf.cursor.line] ?? ''
    const col = before ? buf.cursor.col : buf.cursor.col + 1
    const newLine = line.slice(0, col) + persistent.register + line.slice(col)
    ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
    ctx.setCursor({ line: buf.cursor.line, col: col + persistent.register.length - 1 })
  }
}

export function executeOpenLine(direction: 'above' | 'below', ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  const targetLine = direction === 'below' ? buf.cursor.line + 1 : buf.cursor.line
  ctx.insertAt(targetLine, 0, '\n')
  ctx.setCursor({ line: targetLine, col: 0 })
  ctx.enterInsertMode()
  ctx.setPersistent({ lastChange: { type: 'openLine', direction } })
  return { type: 'openLine', direction }
}

export function executeJoin(count: number, ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  for (let i = 0; i < count && buf.cursor.line < buf.lines.length - 1; i++) {
    const currentLine = buf.lines[buf.cursor.line] ?? ''
    const nextLine = (buf.lines[buf.cursor.line + 1] ?? '').trimStart()
    const joined = currentLine + (currentLine.endsWith(' ') ? '' : ' ') + nextLine
    ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, currentLine.length, joined)
    ctx.deleteLines(buf.cursor.line + 1, 1)
  }
  ctx.setPersistent({ lastChange: { type: 'join', count } })
  return { type: 'join', count }
}

export function executeIndent(dir: '>' | '<', count: number, ctx: OperatorContext): RecordedChange {
  const buf = ctx.getBuffer()
  const startLine = buf.cursor.line
  const endLine = Math.min(startLine + count - 1, buf.lines.length - 1)
  const indent = '  ' // 2-space indent

  for (let i = startLine; i <= endLine; i++) {
    const line = buf.lines[i] ?? ''
    if (dir === '>') {
      ctx.replaceRange(i, 0, i, line.length, indent + line)
    } else {
      if (line.startsWith(indent)) {
        ctx.replaceRange(i, 0, i, line.length, line.slice(indent.length))
      } else if (line.startsWith('\t')) {
        ctx.replaceRange(i, 0, i, line.length, line.slice(1))
      }
    }
  }

  ctx.setPersistent({ lastChange: { type: 'indent', dir, count } })
  return { type: 'indent', dir, count }
}

export function executeOperatorG(
  op: Operator,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  // G motion: go to line (count) or last line
  const buf = ctx.getBuffer()
  const targetLine = count > 0 ? Math.min(count - 1, buf.lines.length - 1) : buf.lines.length - 1
  return executeOperatorMotion(op, 'j', Math.abs(targetLine - buf.cursor.line), ctx)
}

export function executeOperatorGg(
  op: Operator,
  count: number,
  ctx: OperatorContext,
): RecordedChange | null {
  // gg motion: go to first line (or line N)
  const buf = ctx.getBuffer()
  const targetLine = count > 0 ? Math.min(count - 1, buf.lines.length - 1) : 0
  if (targetLine < buf.cursor.line) {
    return executeOperatorMotion(op, 'k', buf.cursor.line - targetLine, ctx)
  }
  return executeOperatorMotion(op, 'j', targetLine - buf.cursor.line, ctx)
}

// ============================================================================
// Helpers
// ============================================================================

function findChar(line: string, startCol: number, findType: FindType, char: string, count: number): number {
  const forward = findType === 'f' || findType === 't'
  let found = 0

  if (forward) {
    for (let i = startCol + 1; i < line.length; i++) {
      if (line[i] === char) {
        found++
        if (found === count) return i
      }
    }
  } else {
    for (let i = startCol - 1; i >= 0; i--) {
      if (line[i] === char) {
        found++
        if (found === count) return i
      }
    }
  }

  return -1
}
