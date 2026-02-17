import { F, SingleParser } from '@masala/parser'
import { FileLiteralNode, GlobLiteralNode } from '../ast.js'

// R-FP-21: ~/ followed by path chars WITHOUT *
const filePathRegex = /~\/[a-zA-Z0-9_\-\.\/]+/

// R-FP-22: ~/ followed by path chars WITH at least one *
const globPathRegex = /~\/[a-zA-Z0-9_\-\.\/]*\*[a-zA-Z0-9_\-\.\/\*]*/

// R-FP-24: Reject paths containing .. (path traversal)
const rejectTraversal = (s: string) => !s.includes('..')

// R-FP-25: Strip trailing slash (directory reference normalization)
const stripTrailingSlash = (s: string) =>
  s.endsWith('/') ? s.slice(0, -1) : s

export const fileLiteralParser: SingleParser<string> = F.regex(filePathRegex)
  .filter(rejectTraversal)
  .map(stripTrailingSlash)

export const globLiteralParser: SingleParser<string> = F.regex(globPathRegex)
  .filter(rejectTraversal)
  .map(stripTrailingSlash)

// R-FP-23: Glob tried first (more specific due to * requirement), file as fallback
export const pathLiteralParser: SingleParser<FileLiteralNode | GlobLiteralNode> =
  F.try(
    globLiteralParser.map(
      (v: string): GlobLiteralNode => ({
        type: 'literal-glob',
        value: v,
      }),
    ),
  ).or(
    fileLiteralParser.map(
      (v: string): FileLiteralNode => ({
        type: 'literal-file',
        value: v,
      }),
    ),
  )
