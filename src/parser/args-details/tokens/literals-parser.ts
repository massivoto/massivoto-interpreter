import { F, SingleParser } from '@masala/parser'
import { AtomicNode } from '../../ast.js'
import { ArgTokens } from './argument-tokens.js'

export function atomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
  const { IDENTIFIER, SYSTEM_VARIABLE, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens

  // R-FP-31: GLOB_PATH before FILE_PATH (more specific due to * requirement)
  // R-SYSVAR-22: SYSTEM_VARIABLE before IDENTIFIER ($ prefix is more specific)
  let ATOMS = F.tryAll([GLOB_PATH, FILE_PATH, SYSTEM_VARIABLE, IDENTIFIER, BOOLEAN, STRING, NUMBER])

  return ATOMS // This is *primary* leaf set (no parentheses yet)
}
