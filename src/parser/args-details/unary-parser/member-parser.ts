import { F, SingleParser, Tuple } from '@masala/parser'
import {
  BareStringNode,
  ExpressionNode,
  IdentifierNode,
  MemberExpressionNode,
} from '../../ast.js'
import { ArgTokens } from '../tokens/argument-tokens.js'

export function createMemberExpressionParser(
  tokens: ArgTokens,
  primary: SingleParser<ExpressionNode>,
): SingleParser<MemberExpressionNode> {
  const { DOT, IDENTIFIER } = tokens
  return primary
    .then(DOT.drop().then(IDENTIFIER).rep())
    .map((tuple: Tuple<ExpressionNode>) => {
      const obj = tuple.first()
      const props = tuple.array().slice(1) as IdentifierNode[]

      // R-LITERAL-05: dot access on bare string upgrades to IdentifierNode (variable reference)
      const resolvedObj: ExpressionNode = obj.type === 'bare-string'
        ? { type: 'identifier' as const, value: (obj as BareStringNode).value }
        : obj

      return {
        type: 'member',
        object: resolvedObj,
        path: props.map((id) => id.value),
        computed: false,
      }
    })
}

export function createPostfixParser(
  tokens: ArgTokens,
  primary: SingleParser<ExpressionNode>,
): SingleParser<ExpressionNode> {
  const member = createMemberExpressionParser(tokens, primary)
  return F.tryAll([member, primary])
}
