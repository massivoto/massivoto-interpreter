import { F, SingleParser } from '@masala/parser'
import { AtomicNode, BareStringNode, IdentifierNode } from '../../ast.js'
import { ArgTokens } from './argument-tokens.js'

// R-LITERAL-01: bare context -- bare identifiers become BareStringNode (literal string)
export function atomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
  const { IDENTIFIER, SYSTEM_VARIABLE, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens

  const BARE_STRING: SingleParser<BareStringNode> = IDENTIFIER.map((id: IdentifierNode) => ({
    type: 'bare-string' as const,
    value: id.value,
  }))

  // R-FP-31: GLOB_PATH before FILE_PATH (more specific due to * requirement)
  // R-SYSVAR-22: SYSTEM_VARIABLE before BARE_STRING ($ prefix is more specific)
  let ATOMS = F.tryAll([GLOB_PATH, FILE_PATH, SYSTEM_VARIABLE, BARE_STRING, BOOLEAN, STRING, NUMBER])

  return ATOMS
}

// R-LITERAL-02: braced context -- identifiers stay as IdentifierNode (variable reference)
export function expressionAtomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
  const { IDENTIFIER, SYSTEM_VARIABLE, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens

  // R-FP-31: GLOB_PATH before FILE_PATH (more specific due to * requirement)
  // R-SYSVAR-22: SYSTEM_VARIABLE before IDENTIFIER ($ prefix is more specific)
  let ATOMS = F.tryAll([GLOB_PATH, FILE_PATH, SYSTEM_VARIABLE, IDENTIFIER, BOOLEAN, STRING, NUMBER])

  return ATOMS
}
