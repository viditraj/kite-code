import React, { useMemo } from 'react'
import { Box, Text } from 'ink'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HighlightedCodeProps {
  code: string
  filePath?: string
  language?: string
  dim?: boolean
  maxLines?: number
  showLineNumbers?: boolean
  startLine?: number
  highlightLines?: Set<number>
}

export interface CodeBlockProps {
  code: string
  language?: string
  filePath?: string
  title?: string
  dim?: boolean
  maxLines?: number
}

export interface InlineCodeProps {
  code: string
  color?: string
}

// ─── Token type ──────────────────────────────────────────────────────────────

interface Token {
  text: string
  color?: string
}

// ─── Language detection ──────────────────────────────────────────────────────

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.php': 'php',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.sql': 'sql',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.dockerfile': 'dockerfile',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.r': 'r',
  '.R': 'r',
  '.lua': 'lua',
  '.vim': 'vim',
  '.el': 'lisp',
  '.clj': 'lisp',
  '.zig': 'zig',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.ml': 'ocaml',
  '.v': 'v',
  '.nim': 'nim',
}

export function detectLanguage(filePath: string): string {
  const basename = filePath.split('/').pop() || filePath

  // Handle Dockerfile (no extension)
  if (basename.toLowerCase() === 'dockerfile') {
    return 'dockerfile'
  }

  // Handle dotfiles like .bashrc, .zshrc
  if (basename.startsWith('.') && !basename.includes('.', 1)) {
    if (basename === '.bashrc' || basename === '.zshrc' || basename === '.bash_profile') {
      return 'bash'
    }
    return 'text'
  }

  const lastDot = basename.lastIndexOf('.')
  if (lastDot === -1) {
    return 'text'
  }

  const ext = basename.slice(lastDot).toLowerCase()
  // Special case: .R should stay uppercase-sensitive
  if (basename.slice(lastDot) === '.R') {
    return EXTENSION_TO_LANGUAGE['.R'] || 'text'
  }

  return EXTENSION_TO_LANGUAGE[ext] || 'text'
}

// ─── Keyword / color definitions ─────────────────────────────────────────────

interface LanguageSpec {
  keywords: string[]
  keywordColor: string
  types: string[]
  typeColor: string
  stringColor: string
  commentColor: string
  numberColor: string
  commentStart: string     // single-line comment prefix
  blockCommentStart?: string
  blockCommentEnd?: string
  hashComment?: boolean    // uses # for comments
}

const TYPESCRIPT_KEYWORDS = [
  'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'export',
  'import', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break',
  'continue', 'async', 'await', 'new', 'this', 'throw', 'try', 'catch',
  'finally', 'default', 'from', 'of', 'in', 'as', 'extends', 'implements',
  'enum', 'namespace', 'abstract', 'private', 'protected', 'public', 'static',
  'readonly', 'override', 'declare', 'module', 'require', 'yield', 'delete',
  'typeof', 'instanceof', 'do', 'with', 'super', 'debugger', 'void',
]

const TYPESCRIPT_TYPES = [
  'string', 'number', 'boolean', 'void', 'null', 'undefined', 'any', 'never',
  'unknown', 'object', 'symbol', 'bigint', 'true', 'false', 'Array', 'Map',
  'Set', 'Promise', 'Record', 'Partial', 'Required', 'Readonly', 'Pick',
  'Omit', 'Exclude', 'Extract', 'ReturnType',
]

const C_LIKE_KEYWORDS = [
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'goto', 'sizeof', 'typedef', 'struct', 'union', 'enum', 'static',
  'extern', 'const', 'volatile', 'register', 'inline', 'auto', 'default',
]

const C_TYPES = [
  'int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned',
  'signed', 'size_t', 'bool', 'true', 'false', 'NULL',
]

const PYTHON_KEYWORDS = [
  'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import',
  'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield',
  'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'in',
  'del', 'global', 'nonlocal', 'assert', 'async', 'await',
]

const PYTHON_TYPES = [
  'None', 'True', 'False', 'int', 'float', 'str', 'bool', 'list', 'dict',
  'tuple', 'set', 'bytes', 'type', 'object', 'self', 'cls',
]

const RUST_KEYWORDS = [
  'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait',
  'pub', 'use', 'mod', 'crate', 'super', 'self', 'Self', 'if', 'else',
  'match', 'for', 'while', 'loop', 'break', 'continue', 'return', 'async',
  'await', 'move', 'ref', 'type', 'where', 'unsafe', 'extern', 'dyn', 'as',
  'in',
]

const RUST_TYPES = [
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64',
  'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Vec',
  'Option', 'Result', 'Box', 'Rc', 'Arc', 'true', 'false', 'None', 'Some',
  'Ok', 'Err',
]

const GO_KEYWORDS = [
  'func', 'var', 'const', 'type', 'struct', 'interface', 'package', 'import',
  'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
  'break', 'continue', 'go', 'defer', 'select', 'chan', 'map', 'make', 'new',
  'append', 'len', 'cap', 'delete', 'fallthrough', 'goto',
]

const GO_TYPES = [
  'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16',
  'uint32', 'uint64', 'float32', 'float64', 'complex64', 'complex128',
  'string', 'bool', 'byte', 'rune', 'error', 'true', 'false', 'nil',
  'iota',
]

const JAVA_KEYWORDS = [
  'class', 'interface', 'enum', 'extends', 'implements', 'public', 'private',
  'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile',
  'transient', 'native', 'new', 'this', 'super', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'throw', 'throws', 'try', 'catch', 'finally', 'import', 'package',
  'instanceof', 'assert', 'void',
]

const JAVA_TYPES = [
  'int', 'long', 'short', 'byte', 'float', 'double', 'char', 'boolean',
  'String', 'Object', 'Integer', 'Long', 'Double', 'Float', 'Boolean',
  'true', 'false', 'null', 'var',
]

const RUBY_KEYWORDS = [
  'def', 'end', 'class', 'module', 'if', 'elsif', 'else', 'unless', 'while',
  'until', 'for', 'do', 'begin', 'rescue', 'ensure', 'raise', 'return',
  'yield', 'block_given?', 'require', 'require_relative', 'include', 'extend',
  'attr_reader', 'attr_writer', 'attr_accessor', 'puts', 'print', 'p',
  'and', 'or', 'not', 'in', 'then', 'when', 'case',
]

const RUBY_TYPES = [
  'nil', 'true', 'false', 'self', 'super', 'Array', 'Hash', 'String',
  'Integer', 'Float', 'Symbol', 'Proc', 'Lambda',
]

const BASH_KEYWORDS = [
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
  'esac', 'in', 'function', 'return', 'exit', 'local', 'export', 'source',
  'echo', 'read', 'set', 'unset', 'shift', 'eval', 'exec', 'trap',
  'declare', 'readonly', 'typeset',
]

const BASH_TYPES = ['true', 'false', 'null']

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN',
  'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
  'MIN', 'MAX', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'PRIMARY',
  'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE',
  'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set',
  'delete', 'create', 'drop', 'alter', 'table', 'index', 'view', 'join',
  'left', 'right', 'inner', 'outer', 'on', 'and', 'or', 'not', 'in',
  'between', 'like', 'is', 'null', 'as', 'order', 'by', 'group', 'having',
  'limit', 'offset', 'union', 'all', 'distinct', 'exists', 'case', 'when',
  'then', 'else', 'end', 'primary', 'key', 'foreign', 'references',
]

const SQL_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'FLOAT', 'DOUBLE', 'DECIMAL',
  'VARCHAR', 'CHAR', 'TEXT', 'BLOB', 'DATE', 'DATETIME', 'TIMESTAMP',
  'BOOLEAN', 'SERIAL', 'UUID',
  'int', 'integer', 'bigint', 'smallint', 'float', 'double', 'decimal',
  'varchar', 'char', 'text', 'blob', 'date', 'datetime', 'timestamp',
  'boolean', 'serial', 'uuid',
]

function buildSpec(
  keywords: string[],
  types: string[],
  commentStart: string,
  hashComment: boolean = false,
  blockCommentStart?: string,
  blockCommentEnd?: string,
): LanguageSpec {
  return {
    keywords,
    keywordColor: 'blue',
    types,
    typeColor: 'cyan',
    stringColor: 'green',
    commentColor: 'gray',
    numberColor: 'yellow',
    commentStart,
    blockCommentStart,
    blockCommentEnd,
    hashComment,
  }
}

const LANGUAGE_SPECS: Record<string, LanguageSpec> = {
  typescript: buildSpec(TYPESCRIPT_KEYWORDS, TYPESCRIPT_TYPES, '//', false, '/*', '*/'),
  javascript: buildSpec(TYPESCRIPT_KEYWORDS, TYPESCRIPT_TYPES, '//', false, '/*', '*/'),
  python: buildSpec(PYTHON_KEYWORDS, PYTHON_TYPES, '#', true),
  ruby: buildSpec(RUBY_KEYWORDS, RUBY_TYPES, '#', true),
  rust: buildSpec(RUST_KEYWORDS, RUST_TYPES, '//', false, '/*', '*/'),
  go: buildSpec(GO_KEYWORDS, GO_TYPES, '//', false, '/*', '*/'),
  java: buildSpec(JAVA_KEYWORDS, JAVA_TYPES, '//', false, '/*', '*/'),
  c: buildSpec(C_LIKE_KEYWORDS, C_TYPES, '//', false, '/*', '*/'),
  cpp: buildSpec(
    [...C_LIKE_KEYWORDS, 'class', 'namespace', 'template', 'virtual', 'override', 'public', 'private', 'protected', 'new', 'delete', 'throw', 'try', 'catch', 'using', 'operator'],
    [...C_TYPES, 'string', 'vector', 'map', 'set', 'pair', 'shared_ptr', 'unique_ptr', 'auto', 'nullptr', 'std'],
    '//', false, '/*', '*/',
  ),
  csharp: buildSpec(
    [...JAVA_KEYWORDS, 'var', 'async', 'await', 'namespace', 'using', 'get', 'set', 'value', 'yield', 'partial', 'sealed', 'override', 'virtual', 'readonly', 'ref', 'out', 'in', 'params', 'delegate', 'event', 'operator', 'implicit', 'explicit', 'where', 'select', 'from', 'let', 'orderby', 'group', 'into'],
    [...JAVA_TYPES, 'string', 'decimal', 'dynamic', 'nint', 'nuint', 'record'],
    '//', false, '/*', '*/',
  ),
  swift: buildSpec(
    ['func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension', 'import', 'return', 'if', 'else', 'guard', 'for', 'while', 'repeat', 'switch', 'case', 'default', 'break', 'continue', 'throw', 'throws', 'try', 'catch', 'do', 'as', 'is', 'in', 'where', 'self', 'Self', 'super', 'init', 'deinit', 'typealias', 'associatedtype', 'public', 'private', 'internal', 'fileprivate', 'open', 'static', 'override', 'mutating', 'nonmutating', 'lazy', 'weak', 'unowned', 'async', 'await'],
    ['Int', 'String', 'Bool', 'Double', 'Float', 'Array', 'Dictionary', 'Set', 'Optional', 'Any', 'AnyObject', 'Void', 'nil', 'true', 'false', 'some', 'none'],
    '//', false, '/*', '*/',
  ),
  kotlin: buildSpec(
    ['fun', 'val', 'var', 'class', 'object', 'interface', 'enum', 'sealed', 'data', 'open', 'abstract', 'override', 'private', 'protected', 'public', 'internal', 'companion', 'import', 'package', 'return', 'if', 'else', 'when', 'for', 'while', 'do', 'break', 'continue', 'throw', 'try', 'catch', 'finally', 'is', 'as', 'in', 'by', 'init', 'constructor', 'suspend', 'inline', 'crossinline', 'noinline', 'reified', 'typealias', 'lateinit', 'lazy'],
    ['Int', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Char', 'String', 'Unit', 'Nothing', 'Any', 'Array', 'List', 'Map', 'Set', 'Pair', 'Triple', 'null', 'true', 'false'],
    '//', false, '/*', '*/',
  ),
  scala: buildSpec(
    ['def', 'val', 'var', 'class', 'object', 'trait', 'extends', 'with', 'import', 'package', 'return', 'if', 'else', 'match', 'case', 'for', 'while', 'do', 'yield', 'throw', 'try', 'catch', 'finally', 'new', 'this', 'super', 'sealed', 'abstract', 'final', 'override', 'private', 'protected', 'implicit', 'lazy', 'type', 'given', 'using', 'enum', 'then', 'end'],
    ['Int', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Char', 'String', 'Unit', 'Nothing', 'Any', 'AnyRef', 'AnyVal', 'Null', 'Option', 'Some', 'None', 'List', 'Map', 'Set', 'Seq', 'Vector', 'Array', 'true', 'false', 'null', 'Nil'],
    '//', false, '/*', '*/',
  ),
  php: buildSpec(
    ['function', 'class', 'interface', 'trait', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'const', 'var', 'new', 'return', 'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'throw', 'try', 'catch', 'finally', 'use', 'namespace', 'require', 'require_once', 'include', 'include_once', 'echo', 'print', 'isset', 'unset', 'empty', 'as', 'match', 'fn', 'yield', 'enum', 'readonly'],
    ['int', 'float', 'string', 'bool', 'array', 'object', 'callable', 'iterable', 'void', 'null', 'true', 'false', 'self', 'parent', 'mixed', 'never'],
    '//', false, '/*', '*/',
  ),
  bash: buildSpec(BASH_KEYWORDS, BASH_TYPES, '#', true),
  sql: buildSpec(SQL_KEYWORDS, SQL_TYPES, '--', false),
  json: buildSpec([], ['true', 'false', 'null'], '//', false),
  yaml: buildSpec([], ['true', 'false', 'null', 'yes', 'no', 'on', 'off'], '#', true),
  toml: buildSpec([], ['true', 'false'], '#', true),
  css: buildSpec(
    ['import', 'media', 'keyframes', 'font-face', 'supports', 'charset'],
    ['inherit', 'initial', 'unset', 'none', 'auto', 'transparent', 'currentColor'],
    '//', false, '/*', '*/',
  ),
  scss: buildSpec(
    ['import', 'include', 'mixin', 'extend', 'if', 'else', 'for', 'each', 'while', 'function', 'return', 'use', 'forward', 'at-root', 'media', 'keyframes'],
    ['inherit', 'initial', 'unset', 'none', 'auto', 'transparent', 'true', 'false', 'null'],
    '//', false, '/*', '*/',
  ),
  markdown: buildSpec([], [], '', false),
  dockerfile: buildSpec(
    ['FROM', 'RUN', 'CMD', 'ENTRYPOINT', 'COPY', 'ADD', 'WORKDIR', 'EXPOSE', 'ENV', 'ARG', 'VOLUME', 'USER', 'LABEL', 'MAINTAINER', 'HEALTHCHECK', 'SHELL', 'STOPSIGNAL', 'ONBUILD'],
    [],
    '#', true,
  ),
  graphql: buildSpec(
    ['type', 'query', 'mutation', 'subscription', 'fragment', 'on', 'input', 'enum', 'interface', 'union', 'scalar', 'schema', 'extend', 'directive', 'implements'],
    ['Int', 'Float', 'String', 'Boolean', 'ID', 'true', 'false', 'null'],
    '#', true,
  ),
  lua: buildSpec(
    ['and', 'break', 'do', 'else', 'elseif', 'end', 'for', 'function', 'goto', 'if', 'in', 'local', 'not', 'or', 'repeat', 'return', 'then', 'until', 'while'],
    ['nil', 'true', 'false', 'self'],
    '--', false, '--[[', ']]',
  ),
  elixir: buildSpec(
    ['def', 'defp', 'defmodule', 'defstruct', 'defprotocol', 'defimpl', 'defmacro', 'defguard', 'defdelegate', 'if', 'else', 'unless', 'cond', 'case', 'when', 'with', 'for', 'do', 'end', 'fn', 'raise', 'rescue', 'try', 'catch', 'after', 'receive', 'send', 'spawn', 'import', 'use', 'alias', 'require', 'in', 'and', 'or', 'not', 'quote', 'unquote'],
    ['nil', 'true', 'false', 'self', 'atom', 'binary', 'bitstring', 'boolean', 'float', 'integer', 'list', 'map', 'number', 'pid', 'port', 'reference', 'tuple'],
    '#', true,
  ),
  haskell: buildSpec(
    ['module', 'where', 'import', 'qualified', 'as', 'hiding', 'data', 'type', 'newtype', 'class', 'instance', 'deriving', 'if', 'then', 'else', 'case', 'of', 'let', 'in', 'do', 'where', 'return', 'forall', 'infixl', 'infixr', 'infix'],
    ['Int', 'Integer', 'Float', 'Double', 'Char', 'String', 'Bool', 'IO', 'Maybe', 'Either', 'Just', 'Nothing', 'Left', 'Right', 'True', 'False', 'Monad', 'Functor', 'Applicative'],
    '--', false, '{-', '-}',
  ),
  r: buildSpec(
    ['if', 'else', 'for', 'while', 'repeat', 'function', 'return', 'next', 'break', 'in', 'library', 'require', 'source'],
    ['TRUE', 'FALSE', 'NULL', 'NA', 'NaN', 'Inf', 'T', 'F'],
    '#', true,
  ),
  zig: buildSpec(
    ['const', 'var', 'fn', 'pub', 'return', 'if', 'else', 'while', 'for', 'break', 'continue', 'switch', 'defer', 'errdefer', 'try', 'catch', 'unreachable', 'async', 'await', 'suspend', 'resume', 'comptime', 'inline', 'export', 'extern', 'test', 'struct', 'enum', 'union', 'error', 'orelse', 'and', 'or'],
    ['void', 'bool', 'noreturn', 'type', 'anytype', 'undefined', 'null', 'true', 'false', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'f16', 'f32', 'f64', 'usize', 'isize', 'comptime_int', 'comptime_float'],
    '//', false,
  ),
  dart: buildSpec(
    ['class', 'abstract', 'extends', 'implements', 'with', 'mixin', 'enum', 'typedef', 'import', 'export', 'library', 'part', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally', 'rethrow', 'new', 'const', 'final', 'var', 'void', 'static', 'async', 'await', 'yield', 'get', 'set', 'operator', 'factory', 'required', 'late', 'covariant', 'super', 'this', 'is', 'as', 'in', 'on', 'show', 'hide'],
    ['int', 'double', 'num', 'String', 'bool', 'List', 'Map', 'Set', 'Future', 'Stream', 'Iterable', 'dynamic', 'Object', 'Null', 'void', 'Never', 'Function', 'Type', 'Symbol', 'true', 'false', 'null'],
    '//', false, '/*', '*/',
  ),
  nim: buildSpec(
    ['proc', 'func', 'method', 'template', 'macro', 'iterator', 'converter', 'var', 'let', 'const', 'type', 'object', 'enum', 'tuple', 'ref', 'ptr', 'if', 'elif', 'else', 'when', 'case', 'of', 'for', 'while', 'block', 'break', 'continue', 'return', 'yield', 'discard', 'import', 'include', 'from', 'export', 'except', 'try', 'except', 'finally', 'raise', 'defer', 'and', 'or', 'not', 'xor', 'in', 'notin', 'is', 'isnot', 'as', 'div', 'mod', 'shl', 'shr'],
    ['int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'float32', 'float64', 'bool', 'char', 'string', 'seq', 'array', 'openArray', 'set', 'nil', 'true', 'false', 'void', 'auto'],
    '#', true,
  ),
  ocaml: buildSpec(
    ['let', 'rec', 'in', 'of', 'if', 'then', 'else', 'match', 'with', 'fun', 'function', 'type', 'module', 'struct', 'sig', 'end', 'val', 'open', 'include', 'exception', 'try', 'raise', 'begin', 'end', 'for', 'while', 'do', 'done', 'to', 'downto', 'and', 'or', 'not', 'mod', 'land', 'lor', 'lxor', 'lsl', 'lsr', 'asr', 'mutable', 'ref', 'assert', 'lazy'],
    ['int', 'float', 'bool', 'char', 'string', 'unit', 'list', 'array', 'option', 'result', 'ref', 'exn', 'true', 'false', 'None', 'Some', 'Ok', 'Error'],
    '//', false, '(*', '*)',
  ),
  v: buildSpec(
    ['fn', 'mut', 'const', 'struct', 'enum', 'union', 'interface', 'type', 'pub', 'import', 'module', 'return', 'if', 'else', 'for', 'in', 'match', 'or', 'break', 'continue', 'go', 'spawn', 'defer', 'unsafe', 'assert', 'as', 'is', 'none', 'lock', 'rlock', 'shared', 'atomic', 'asm', 'sql'],
    ['int', 'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64', 'byte', 'bool', 'string', 'rune', 'voidptr', 'charptr', 'byteptr', 'true', 'false', 'none'],
    '//', false, '/*', '*/',
  ),
  erlang: buildSpec(
    ['module', 'export', 'import', 'if', 'case', 'of', 'end', 'when', 'receive', 'after', 'throw', 'try', 'catch', 'fun', 'begin', 'and', 'andalso', 'or', 'orelse', 'not', 'bnot', 'band', 'bor', 'bxor', 'bsl', 'bsr', 'div', 'rem', 'spec', 'type', 'record'],
    ['true', 'false', 'undefined', 'ok', 'error', 'nil'],
    '%', false,
  ),
  lisp: buildSpec(
    ['defun', 'defmacro', 'defvar', 'defconst', 'defparameter', 'let', 'let*', 'lambda', 'if', 'cond', 'when', 'unless', 'progn', 'prog1', 'setq', 'setf', 'quote', 'eval', 'apply', 'funcall', 'mapcar', 'loop', 'do', 'dolist', 'dotimes', 'return', 'block', 'tagbody', 'go', 'throw', 'catch', 'unwind-protect', 'defclass', 'defmethod', 'defgeneric', 'require', 'provide', 'in-package', 'defpackage', 'use-package',
      'def', 'defn', 'defmacro', 'fn', 'let', 'if', 'cond', 'when', 'do', 'loop', 'recur', 'map', 'filter', 'reduce', 'require', 'ns', 'use', 'import'],
    ['t', 'nil', 'true', 'false', 'null'],
    ';', false,
  ),
  vim: buildSpec(
    ['let', 'set', 'if', 'else', 'elseif', 'endif', 'for', 'endfor', 'while', 'endwhile', 'function', 'endfunction', 'return', 'call', 'execute', 'autocmd', 'augroup', 'command', 'map', 'nmap', 'vmap', 'imap', 'noremap', 'nnoremap', 'vnoremap', 'inoremap', 'syntax', 'highlight', 'filetype', 'source', 'echo', 'echom', 'try', 'catch', 'finally', 'endtry', 'throw'],
    ['v:true', 'v:false', 'v:null', 'v:none'],
    '"', false,
  ),
  xml: buildSpec([], [], '', false),
  html: buildSpec([], [], '', false),
  less: buildSpec(
    ['import', 'when', 'not', 'and', 'each', 'mixin'],
    ['inherit', 'initial', 'unset', 'none', 'auto', 'transparent', 'true', 'false'],
    '//', false, '/*', '*/',
  ),
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function isWordBoundary(ch: string | undefined): boolean {
  if (ch === undefined) return true
  return !/[a-zA-Z0-9_$]/.test(ch)
}

export function tokenizeLine(line: string, language: string): Token[] {
  const spec = LANGUAGE_SPECS[language]
  if (!spec) {
    return [{ text: line }]
  }

  const tokens: Token[] = []
  let i = 0
  const len = line.length

  // Build keyword and type sets for fast lookup
  const keywordSet = new Set(spec.keywords)
  const typeSet = new Set(spec.types)

  function pushToken(text: string, color?: string): void {
    if (text.length > 0) {
      tokens.push({ text, color })
    }
  }

  // Track accumulated plain text
  let plainStart = -1

  function flushPlain(): void {
    if (plainStart >= 0 && plainStart < i) {
      pushToken(line.slice(plainStart, i))
      plainStart = -1
    }
  }

  while (i < len) {
    // Check for single-line comment
    if (spec.commentStart && spec.commentStart.length > 0) {
      if (line.startsWith(spec.commentStart, i)) {
        flushPlain()
        pushToken(line.slice(i), spec.commentColor)
        return tokens
      }
    }

    // Check for hash comment
    if (spec.hashComment && line[i] === '#') {
      flushPlain()
      pushToken(line.slice(i), spec.commentColor)
      return tokens
    }

    // Check for block comment start (treat rest of line as comment for simplicity)
    if (spec.blockCommentStart && line.startsWith(spec.blockCommentStart, i)) {
      flushPlain()
      // Find end of block comment on same line
      const endIdx = line.indexOf(spec.blockCommentEnd!, i + spec.blockCommentStart.length)
      if (endIdx >= 0) {
        const commentEnd = endIdx + spec.blockCommentEnd!.length
        pushToken(line.slice(i, commentEnd), spec.commentColor)
        i = commentEnd
        plainStart = i
        continue
      } else {
        // Comment extends to end of line
        pushToken(line.slice(i), spec.commentColor)
        return tokens
      }
    }

    // Check for strings
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      flushPlain()
      const quote = line[i]
      let j = i + 1
      while (j < len) {
        if (line[j] === '\\') {
          j += 2 // skip escaped char
          continue
        }
        if (line[j] === quote) {
          j++
          break
        }
        j++
      }
      pushToken(line.slice(i, j), spec.stringColor)
      i = j
      plainStart = i
      continue
    }

    // Check for numbers
    if (/[0-9]/.test(line[i]) && isWordBoundary(line[i - 1])) {
      flushPlain()
      let j = i
      // Hex
      if (line[i] === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        j = i + 2
        while (j < len && /[0-9a-fA-F_]/.test(line[j])) j++
      }
      // Binary
      else if (line[i] === '0' && (line[i + 1] === 'b' || line[i + 1] === 'B')) {
        j = i + 2
        while (j < len && /[01_]/.test(line[j])) j++
      }
      // Octal
      else if (line[i] === '0' && (line[i + 1] === 'o' || line[i + 1] === 'O')) {
        j = i + 2
        while (j < len && /[0-7_]/.test(line[j])) j++
      }
      // Decimal (with optional dot and exponent)
      else {
        while (j < len && /[0-9_]/.test(line[j])) j++
        if (j < len && line[j] === '.') {
          j++
          while (j < len && /[0-9_]/.test(line[j])) j++
        }
        if (j < len && (line[j] === 'e' || line[j] === 'E')) {
          j++
          if (j < len && (line[j] === '+' || line[j] === '-')) j++
          while (j < len && /[0-9_]/.test(line[j])) j++
        }
      }
      // Type suffix like n (bigint), f, u, i etc.
      if (j < len && /[nfuil]/.test(line[j]) && isWordBoundary(line[j + 1])) {
        j++
      }
      pushToken(line.slice(i, j), spec.numberColor)
      i = j
      plainStart = i
      continue
    }

    // Check for identifiers (keywords and types)
    if (/[a-zA-Z_$]/.test(line[i]) && isWordBoundary(line[i - 1])) {
      let j = i
      while (j < len && /[a-zA-Z0-9_$?]/.test(line[j])) j++

      const word = line.slice(i, j)

      if (keywordSet.has(word) && isWordBoundary(line[j])) {
        flushPlain()
        pushToken(word, spec.keywordColor)
        i = j
        plainStart = i
        continue
      }

      if (typeSet.has(word) && isWordBoundary(line[j])) {
        flushPlain()
        pushToken(word, spec.typeColor)
        i = j
        plainStart = i
        continue
      }

      // Not a keyword or type — just a regular identifier, part of plain text
      if (plainStart < 0) plainStart = i
      i = j
      continue
    }

    // Default: accumulate as plain text
    if (plainStart < 0) plainStart = i
    i++
  }

  flushPlain()
  return tokens
}

// ─── HighlightedCode Component ───────────────────────────────────────────────

export const HighlightedCode: React.FC<HighlightedCodeProps> = ({
  code,
  filePath,
  language,
  dim = false,
  maxLines,
  showLineNumbers = false,
  startLine = 1,
  highlightLines,
}) => {
  const resolvedLanguage = useMemo(() => {
    if (language) return language
    if (filePath) return detectLanguage(filePath)
    return 'text'
  }, [language, filePath])

  const processedLines = useMemo(() => {
    // Convert tabs to 2 spaces
    const normalized = code.replace(/\t/g, '  ')
    let lines = normalized.split('\n')

    // Remove trailing empty line if present (common with template literals)
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines = lines.slice(0, -1)
    }

    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines)
    }

    return lines
  }, [code, maxLines])

  const lineNumberWidth = useMemo(() => {
    if (!showLineNumbers) return 0
    const lastLine = startLine + processedLines.length - 1
    return String(lastLine).length
  }, [showLineNumbers, startLine, processedLines.length])

  const truncated = maxLines ? code.split('\n').length > maxLines : false

  return (
    <Box flexDirection="column">
      {processedLines.map((line, idx) => {
        const lineNumber = startLine + idx
        const isHighlighted = highlightLines?.has(lineNumber) ?? false
        const tokens = tokenizeLine(line, resolvedLanguage)

        return (
          <Box key={idx}>
            {showLineNumbers && (
              <Text
                color="gray"
                dimColor={dim}
              >
                {String(lineNumber).padStart(lineNumberWidth, ' ')}
                {'  '}
              </Text>
            )}
            <Text
              backgroundColor={isHighlighted ? 'yellow' : undefined}
              dimColor={dim}
            >
              {tokens.length === 0 ? (
                ' '
              ) : (
                tokens.map((token, tokenIdx) => (
                  <Text
                    key={tokenIdx}
                    color={isHighlighted ? 'black' : (dim ? 'gray' : token.color)}
                    dimColor={dim && !token.color}
                  >
                    {token.text}
                  </Text>
                ))
              )}
            </Text>
          </Box>
        )
      })}
      {truncated && (
        <Text color="gray" dimColor={dim}>
          {'  ... (' + (code.split('\n').length - maxLines!) + ' more lines)'}
        </Text>
      )}
    </Box>
  )
}

// ─── CodeBlock Component ─────────────────────────────────────────────────────

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  filePath,
  title,
  dim = false,
  maxLines,
}) => {
  const displayTitle = title || language || (filePath ? detectLanguage(filePath) : undefined)
  const borderChar = '─'

  return (
    <Box flexDirection="column">
      {/* Title bar */}
      <Text color="gray" dimColor={dim}>
        {displayTitle
          ? `${borderChar}${borderChar} ${displayTitle} ${borderChar.repeat(Math.max(0, 40 - displayTitle.length))}`
          : borderChar.repeat(44)
        }
      </Text>

      {/* Code content */}
      <Box paddingLeft={1}>
        <HighlightedCode
          code={code}
          filePath={filePath}
          language={language}
          dim={dim}
          maxLines={maxLines}
          showLineNumbers={true}
          startLine={1}
        />
      </Box>

      {/* Bottom border */}
      <Text color="gray" dimColor={dim}>
        {borderChar.repeat(44)}
      </Text>
    </Box>
  )
}

// ─── InlineCode Component ────────────────────────────────────────────────────

export const InlineCode: React.FC<InlineCodeProps> = ({
  code,
  color,
}) => {
  if (color) {
    return (
      <Text color={color} bold>
        {' `'}{code}{'` '}
      </Text>
    )
  }

  return (
    <Text inverse>
      {' '}{code}{' '}
    </Text>
  )
}

export default HighlightedCode
