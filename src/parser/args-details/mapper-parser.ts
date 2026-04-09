import { F, SingleParser, Tuple } from '@masala/parser'
import {
  ExpressionNode,
  IdentifierNode,
  MapperExpressionNode,
  BindingNode,
  ReferenceNode,
} from '../ast.js'
import { ArgTokens } from './tokens/argument-tokens.js'

/**
 * Creates a mapper expression parser.
 *
 * Mapper expressions use the `->` operator for scope reference -> binding:
 * - `users -> user` reads 'users' from scope, binds each element to 'user'
 * - `data.users -> user` reads 'data.users' path from scope, binds to 'user'
 *
 * The mapper has the LOWEST precedence in the expression hierarchy.
 * It only accepts simple/dotted references as source (not pipes, arrays, etc.).
 * Complex sources are handled by the forEach fallback path in instruction-parser.
 *
 * Grammar: mapperExpression = reference ARROW binding | baseExpression
 * where reference = IDENTIFIER (DOT IDENTIFIER)*
 * and binding = IDENTIFIER
 */
export function createMapperParser(
  tokens: ArgTokens,
  baseExpression: SingleParser<ExpressionNode>,
): SingleParser<ExpressionNode> {
  const { ARROW, IDENTIFIER, DOT } = tokens

  // Reference parser: IDENTIFIER(.IDENTIFIER)* -> ReferenceNode
  const reference: SingleParser<ReferenceNode> = IDENTIFIER.then(
    DOT.drop().then(IDENTIFIER).optrep(),
  ).map((tuple: Tuple<IdentifierNode>) => {
    const first = tuple.first() as IdentifierNode
    const rest = tuple.array().slice(1) as IdentifierNode[]
    const path = [first.value, ...rest.map((id) => id.value)]
    return { type: 'reference', path } as ReferenceNode
  })

  // Binding parser: IDENTIFIER -> BindingNode
  const binding: SingleParser<BindingNode> = IDENTIFIER.map(
    (id: IdentifierNode): BindingNode => ({
      type: 'binding',
      name: id.value,
    }),
  )

  // Parse: reference ARROW binding (produces MapperExpressionNode)
  const mapperExpression = reference
    .then(ARROW.drop())
    .then(binding)
    .map((tuple: Tuple<ReferenceNode | BindingNode>) => {
      const source = tuple.first() as ReferenceNode
      const target = tuple.last() as BindingNode
      return {
        type: 'mapper',
        source,
        target,
      } as MapperExpressionNode
    })

  // Try mapper first (has arrow with reference source), otherwise just the base expression
  return F.try(mapperExpression).or(baseExpression)
}
