import { C, F, N, SingleParser } from '@masala/parser'
import { quote } from './args-details/argument-simple-parsers.js'

export const oneSpace = C.char(' ')
  .or(C.char('\t'))
  .or(C.char('\n'))
  .or(F.eos())
export const spaces = oneSpace.rep()

// Reserved words that cannot be used as identifiers.
// - Literals: parsed by dedicated parsers (booleanLiteral)
// - Reserved args: parsed by dedicated tokens (OUTPUT_KEY, IF_KEY)
// - Control flow: reserved for future @if/begin, @forEach/begin, @while/begin blocks
const reservedWords = [
  // Literals
  'true',
  'false',
  // Reserved arguments
  'output',
  'if',
  'retry',
  'collect',
  // Control flow (future)
  'for',
  'forEach',
  'for-each',
  'in',
  'else',
  'endif',
  'while',
  'repeat',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'return',
]

export const identifier = F.regex(/[a-zA-Z_][a-zA-Z0-9_-]*/)
  .filter((s) => s.charAt(s.length - 1) !== '-')
  .filter((s) => !reservedWords.includes(s))

// R-SYSVAR-21: System variable token matches $[a-zA-Z_][a-zA-Z0-9_]*
// Returns the name WITHOUT the $ prefix (e.g. 'index' for $index)
export const systemVariable = F.regex(/\$[a-zA-Z_][a-zA-Z0-9_]*/).map(
  (s) => s.slice(1),
)

export const numberLiteral = N.number()

export const booleanLiteral: SingleParser<boolean> = C.stringIn([
  'true',
  'false',
]).map((v) => v === 'true')
// Process escape sequences in a string: \\, \/, \n, \t
function processEscapes(str: string): string {
  return str.replace(/\\([\\/nt])/g, (_, char) => {
    switch (char) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      default:
        return char // \ or /
    }
  })
}

// Build a string body parser for a given delimiter character
function stringBody(delim: string) {
  // Escape sequences: \\ \/ \n \t (no \" or \' -- use the other delimiter)
  const escaped = C.char('\\').then(C.charIn('\\/nt'))
  // Any char except the closing delimiter or newline
  const notDelimOrNewline = F.not(C.charIn(delim + '\n'))
  return escaped.or(notDelimOrNewline).optrep()
    .then(C.char(delim))
    .map((tuple) => {
      const raw = tuple.array().flat().join('')
      // raw ends with closing delimiter, remove it and process escapes
      return processEscapes(raw.slice(0, -1))
    })
}

// String literal: matches "..." or '...' and processes escape sequences
// Opening delimiter determines which closing delimiter is expected
export const stringLiteral = quote.flatMap((delim: string) => stringBody(delim))
