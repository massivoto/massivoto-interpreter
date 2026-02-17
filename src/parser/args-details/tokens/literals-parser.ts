import { F, SingleParser } from '@masala/parser'
import { AtomicNode } from '../../ast.js'
import { ArgTokens } from './argument-tokens.js'

export function atomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
  const { IDENTIFIER, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens

  // R-FP-31: GLOB_PATH before FILE_PATH (more specific due to * requirement)
  let ATOMS = F.tryAll([GLOB_PATH, FILE_PATH, IDENTIFIER, BOOLEAN, STRING, NUMBER])

  return ATOMS // This is *primary* leaf set (no parentheses yet)
}
