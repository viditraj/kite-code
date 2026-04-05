/**
 * Vim state transition table.
 *
 * Implements the same transition logic as Claude Code's vim/transitions.ts:
 * - Each state has a dedicated transition function
 * - Returns { next, execute } — next state and optional side effect
 * - Main dispatch based on CommandState.type
 */

import { resolveMotion } from './motions.js'
import {
  executeIndent,
  executeJoin,
  executeLineOp,
  executeOpenLine,
  executeOperatorFind,
  executeOperatorG,
  executeOperatorGg,
  executeOperatorMotion,
  executeOperatorTextObj,
  executePaste,
  executeReplace,
  executeToggleCase,
  executeX,
  type OperatorContext,
} from './operators.js'
import {
  type CommandState,
  FIND_KEYS,
  type FindType,
  isOperatorKey,
  isTextObjScopeKey,
  MAX_VIM_COUNT,
  OPERATORS,
  type Operator,
  SIMPLE_MOTIONS,
  TEXT_OBJ_SCOPES,
  TEXT_OBJ_TYPES,
  type TextObjScope,
} from './types.js'

// ============================================================================
// Context and Result types
// ============================================================================

export type TransitionContext = OperatorContext & {
  onUndo?: () => void
  onDotRepeat?: () => void
}

export type TransitionResult = {
  next?: CommandState
  execute?: () => void
}

// ============================================================================
// Main transition dispatch
// ============================================================================

export function transition(
  state: CommandState,
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  switch (state.type) {
    case 'idle':
      return fromIdle(input, ctx)
    case 'count':
      return fromCount(state, input, ctx)
    case 'operator':
      return fromOperator(state, input, ctx)
    case 'operatorCount':
      return fromOperatorCount(state, input, ctx)
    case 'operatorFind':
      return fromOperatorFind(state, input, ctx)
    case 'operatorTextObj':
      return fromOperatorTextObj(state, input, ctx)
    case 'find':
      return fromFind(state, input, ctx)
    case 'g':
      return fromG(state, input, ctx)
    case 'operatorG':
      return fromOperatorG(state, input, ctx)
    case 'replace':
      return fromReplace(state, input, ctx)
    case 'indent':
      return fromIndent(state, input, ctx)
  }
}

// ============================================================================
// Shared input handling
// ============================================================================

function handleNormalInput(
  input: string,
  count: number,
  ctx: TransitionContext,
): TransitionResult | null {
  // Simple motions
  if (SIMPLE_MOTIONS.has(input)) {
    const buf = ctx.getBuffer()
    const motion = resolveMotion(input, buf, count)
    if (motion) {
      return { execute: () => ctx.setCursor(motion.newCursor) }
    }
    return {}
  }

  // Find keys
  if (FIND_KEYS.has(input)) {
    return { next: { type: 'find', find: input as FindType, count } }
  }

  // Operator keys
  if (isOperatorKey(input)) {
    return { next: { type: 'operator', op: OPERATORS[input], count } }
  }

  // g prefix
  if (input === 'g') {
    return { next: { type: 'g', count } }
  }

  // Replace
  if (input === 'r') {
    return { next: { type: 'replace', count } }
  }

  // Indent
  if (input === '>' || input === '<') {
    return { next: { type: 'indent', dir: input, count } }
  }

  // x - delete char under cursor
  if (input === 'x') {
    return { execute: () => executeX(count, ctx) }
  }

  // X - delete char before cursor (backspace)
  if (input === 'X') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        if (buf.cursor.col > 0) {
          ctx.setCursor({ line: buf.cursor.line, col: buf.cursor.col - 1 })
          executeX(count, ctx)
        }
      },
    }
  }

  // ~ toggle case
  if (input === '~') {
    return { execute: () => executeToggleCase(count, ctx) }
  }

  // p/P paste
  if (input === 'p') {
    return { execute: () => executePaste(false, ctx) }
  }
  if (input === 'P') {
    return { execute: () => executePaste(true, ctx) }
  }

  // o/O open line
  if (input === 'o') {
    return { execute: () => executeOpenLine('below', ctx) }
  }
  if (input === 'O') {
    return { execute: () => executeOpenLine('above', ctx) }
  }

  // J join lines
  if (input === 'J') {
    return { execute: () => executeJoin(count, ctx) }
  }

  // u undo
  if (input === 'u') {
    return { execute: () => ctx.onUndo?.() }
  }

  // . dot repeat
  if (input === '.') {
    return { execute: () => ctx.onDotRepeat?.() }
  }

  // ; repeat last find
  if (input === ';') {
    const lastFind = ctx.getPersistent().lastFind
    if (lastFind) {
      return {
        execute: () => {
          const buf = ctx.getBuffer()
          const line = buf.lines[buf.cursor.line] ?? ''
          const forward = lastFind.type === 'f' || lastFind.type === 't'
          let targetCol = -1
          if (forward) {
            for (let i = buf.cursor.col + 1; i < line.length; i++) {
              if (line[i] === lastFind.char) { targetCol = i; break }
            }
          } else {
            for (let i = buf.cursor.col - 1; i >= 0; i--) {
              if (line[i] === lastFind.char) { targetCol = i; break }
            }
          }
          if (targetCol >= 0) {
            if (lastFind.type === 't' && targetCol > buf.cursor.col) targetCol--
            if (lastFind.type === 'T' && targetCol < buf.cursor.col) targetCol++
            ctx.setCursor({ line: buf.cursor.line, col: targetCol })
          }
        },
      }
    }
    return {}
  }

  // , reverse last find
  if (input === ',') {
    const lastFind = ctx.getPersistent().lastFind
    if (lastFind) {
      const reverseType: Record<string, FindType> = { f: 'F', F: 'f', t: 'T', T: 't' }
      const reversed = reverseType[lastFind.type]!
      return {
        execute: () => {
          const buf = ctx.getBuffer()
          const line = buf.lines[buf.cursor.line] ?? ''
          const forward = reversed === 'f' || reversed === 't'
          let targetCol = -1
          if (forward) {
            for (let i = buf.cursor.col + 1; i < line.length; i++) {
              if (line[i] === lastFind.char) { targetCol = i; break }
            }
          } else {
            for (let i = buf.cursor.col - 1; i >= 0; i--) {
              if (line[i] === lastFind.char) { targetCol = i; break }
            }
          }
          if (targetCol >= 0) {
            ctx.setCursor({ line: buf.cursor.line, col: targetCol })
          }
        },
      }
    }
    return {}
  }

  // G - go to last line (or line N with count)
  if (input === 'G') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const target = count > 1 ? Math.min(count - 1, buf.lines.length - 1) : buf.lines.length - 1
        ctx.setCursor({ line: target, col: 0 })
      },
    }
  }

  return null
}

// ============================================================================
// State-specific transitions
// ============================================================================

function fromIdle(input: string, ctx: TransitionContext): TransitionResult {
  // Count prefix (1-9 starts count, 0 is line start)
  if (input >= '1' && input <= '9') {
    return { next: { type: 'count', digits: input } }
  }

  // Insert mode entry keys
  if (input === 'i') {
    return { execute: () => ctx.enterInsertMode() }
  }
  if (input === 'I') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const line = buf.lines[buf.cursor.line] ?? ''
        const firstNonBlank = line.search(/\S/)
        ctx.setCursor({ line: buf.cursor.line, col: firstNonBlank >= 0 ? firstNonBlank : 0 })
        ctx.enterInsertMode()
      },
    }
  }
  if (input === 'a') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const line = buf.lines[buf.cursor.line] ?? ''
        ctx.setCursor({ line: buf.cursor.line, col: Math.min(buf.cursor.col + 1, line.length) })
        ctx.enterInsertMode()
      },
    }
  }
  if (input === 'A') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const line = buf.lines[buf.cursor.line] ?? ''
        ctx.setCursor({ line: buf.cursor.line, col: line.length })
        ctx.enterInsertMode()
      },
    }
  }
  if (input === 's') {
    return { execute: () => { executeX(1, ctx); ctx.enterInsertMode() } }
  }
  if (input === 'S' || input === 'C') {
    return { execute: () => executeLineOp(input === 'S' ? 'change' : 'change', 1, ctx) }
  }
  if (input === 'D') {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const line = buf.lines[buf.cursor.line] ?? ''
        const text = line.slice(buf.cursor.col)
        const newLine = line.slice(0, buf.cursor.col)
        ctx.replaceRange(buf.cursor.line, 0, buf.cursor.line, line.length, newLine)
        ctx.setPersistent({ register: text, registerIsLinewise: false })
      },
    }
  }
  if (input === 'Y') {
    return { execute: () => executeLineOp('yank', 1, ctx) }
  }

  return handleNormalInput(input, 1, ctx) ?? {}
}

function fromCount(state: { digits: string }, input: string, ctx: TransitionContext): TransitionResult {
  if (input >= '0' && input <= '9') {
    const newDigits = state.digits + input
    const count = parseInt(newDigits, 10)
    if (count > MAX_VIM_COUNT) return { next: { type: 'idle' } }
    return { next: { type: 'count', digits: newDigits } }
  }

  const count = parseInt(state.digits, 10)
  return handleNormalInput(input, count, ctx) ?? { next: { type: 'idle' } }
}

function fromOperator(state: { op: Operator; count: number }, input: string, ctx: TransitionContext): TransitionResult {
  // Double operator = line operation (dd, cc, yy)
  if (isOperatorKey(input) && OPERATORS[input] === state.op) {
    return { execute: () => executeLineOp(state.op, state.count, ctx) }
  }

  // Count after operator
  if (input >= '1' && input <= '9') {
    return { next: { type: 'operatorCount', op: state.op, count: state.count, digits: input } }
  }

  // Motion
  if (SIMPLE_MOTIONS.has(input)) {
    return { execute: () => executeOperatorMotion(state.op, input, state.count, ctx) }
  }

  // Find
  if (FIND_KEYS.has(input)) {
    return { next: { type: 'operatorFind', op: state.op, count: state.count, find: input as FindType } }
  }

  // Text object scope
  if (isTextObjScopeKey(input)) {
    return { next: { type: 'operatorTextObj', op: state.op, count: state.count, scope: TEXT_OBJ_SCOPES[input] } }
  }

  // g prefix in operator
  if (input === 'g') {
    return { next: { type: 'operatorG', op: state.op, count: state.count } }
  }

  // G motion in operator
  if (input === 'G') {
    return { execute: () => executeOperatorG(state.op, state.count, ctx) }
  }

  return { next: { type: 'idle' } }
}

function fromOperatorCount(
  state: { op: Operator; count: number; digits: string },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  if (input >= '0' && input <= '9') {
    const newDigits = state.digits + input
    const innerCount = parseInt(newDigits, 10)
    if (innerCount > MAX_VIM_COUNT) return { next: { type: 'idle' } }
    return { next: { type: 'operatorCount' as const, ...state, digits: newDigits } }
  }

  const innerCount = parseInt(state.digits, 10)
  const totalCount = state.count * innerCount

  if (SIMPLE_MOTIONS.has(input)) {
    return { execute: () => executeOperatorMotion(state.op, input, totalCount, ctx) }
  }

  if (FIND_KEYS.has(input)) {
    return { next: { type: 'operatorFind', op: state.op, count: totalCount, find: input as FindType } }
  }

  if (isTextObjScopeKey(input)) {
    return { next: { type: 'operatorTextObj', op: state.op, count: totalCount, scope: TEXT_OBJ_SCOPES[input] } }
  }

  return { next: { type: 'idle' } }
}

function fromOperatorFind(
  state: { op: Operator; count: number; find: FindType },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  if (input.length === 1) {
    return { execute: () => executeOperatorFind(state.op, state.find, input, state.count, ctx) }
  }
  return { next: { type: 'idle' } }
}

function fromOperatorTextObj(
  state: { op: Operator; count: number; scope: TextObjScope },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  if (TEXT_OBJ_TYPES.has(input)) {
    return { execute: () => executeOperatorTextObj(state.op, input, state.scope, state.count, ctx) }
  }
  return { next: { type: 'idle' } }
}

function fromFind(
  state: { find: FindType; count: number },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  if (input.length === 1) {
    return {
      execute: () => {
        const buf = ctx.getBuffer()
        const line = buf.lines[buf.cursor.line] ?? ''
        const forward = state.find === 'f' || state.find === 't'
        let targetCol = -1
        let found = 0

        if (forward) {
          for (let i = buf.cursor.col + 1; i < line.length; i++) {
            if (line[i] === input) {
              found++
              if (found === state.count) { targetCol = i; break }
            }
          }
        } else {
          for (let i = buf.cursor.col - 1; i >= 0; i--) {
            if (line[i] === input) {
              found++
              if (found === state.count) { targetCol = i; break }
            }
          }
        }

        if (targetCol >= 0) {
          if (state.find === 't' && targetCol > buf.cursor.col) targetCol--
          if (state.find === 'T' && targetCol < buf.cursor.col) targetCol++
          ctx.setCursor({ line: buf.cursor.line, col: targetCol })
          ctx.setPersistent({ lastFind: { type: state.find, char: input } })
        }
      },
    }
  }
  return { next: { type: 'idle' } }
}

function fromG(state: { count: number }, input: string, ctx: TransitionContext): TransitionResult {
  if (input === 'g') {
    // gg - go to first line (or line N)
    return {
      execute: () => {
        const target = state.count > 1 ? Math.min(state.count - 1, ctx.getBuffer().lines.length - 1) : 0
        ctx.setCursor({ line: target, col: 0 })
      },
    }
  }
  return { next: { type: 'idle' } }
}

function fromOperatorG(
  state: { op: Operator; count: number },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  if (input === 'g') {
    return { execute: () => executeOperatorGg(state.op, state.count, ctx) }
  }
  return { next: { type: 'idle' } }
}

function fromReplace(state: { count: number }, input: string, ctx: TransitionContext): TransitionResult {
  if (input.length === 1 && input !== '\x1b') {
    return { execute: () => executeReplace(input, state.count, ctx) }
  }
  return { next: { type: 'idle' } }
}

function fromIndent(
  state: { dir: '>' | '<'; count: number },
  input: string,
  ctx: TransitionContext,
): TransitionResult {
  // >> or << (double indent = indent current line)
  if (input === state.dir) {
    return { execute: () => executeIndent(state.dir, state.count, ctx) }
  }
  return { next: { type: 'idle' } }
}
