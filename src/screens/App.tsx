/**
 * App — Root application component.
 *
 * Wraps the REPL screen with context providers and error boundaries.
 * Matches Claude Code's App.tsx pattern with context nesting.
 */

import React from 'react'
import { REPL, type REPLProps } from './REPL.js'

export const App: React.FC<REPLProps> = (props) => {
  return <REPL {...props} />
}
